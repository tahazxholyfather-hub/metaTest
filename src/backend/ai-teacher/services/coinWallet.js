'use strict';

const { COIN_PRICING, dailyCoinsForPlan, localDateString } = require('../config');
const pricing = require('./pricing');

/**
 * Coin wallet — the student's currency (distinct from provider tokens).
 *
 * Two buckets:
 *  - daily_balance     free coins granted once per local calendar day; whatever
 *                      is left expires when the next grant happens (no rollover)
 *  - purchased_balance bought/bonus coins; never expire
 *
 * Spending always drains the daily bucket first. Every movement is written to
 * tam24_ai_coin_transactions with per-bucket deltas, inside the caller's
 * transaction, under a row lock (SELECT ... FOR UPDATE) so concurrent requests
 * can never double-spend. `balance` on the wallet row is a mirrored total kept
 * for older readers.
 */

const LEDGER = Object.freeze({
    DAILY_GRANT: 'daily_grant',
    DAILY_EXPIRE: 'daily_expire',
    AI_USAGE: 'ai_usage',
    RESERVATION: 'reservation',
    RESERVATION_RELEASE: 'reservation_release',
    REFUND: 'refund',
    PURCHASE: 'purchase',
    BONUS: 'bonus',
    ADMIN_ADJUSTMENT: 'admin_adjustment',
});

const insufficient = (balance) => {
    const err = new Error('موجودی سکه کافی نیست.');
    err.code = 'INSUFFICIENT_COINS';
    err.balance = balance;
    return err;
};

const n = (v) => Math.max(0, Math.floor(Number(v) || 0));

async function ensureWallet(conn, userId) {
    await conn.query(
        `INSERT IGNORE INTO tam24_ai_wallets (user_id, balance, daily_balance, purchased_balance, lifetime_earned, lifetime_spent)
         VALUES (?, 0, 0, 0, 0, 0)`,
        [userId]
    );
}

function shape(row) {
    const daily = n(row?.daily_balance);
    const purchased = n(row?.purchased_balance);
    return {
        userId: row?.user_id,
        daily,
        purchased,
        total: daily + purchased,
        lifetimeEarned: n(row?.lifetime_earned),
        lifetimeSpent: n(row?.lifetime_spent),
        dailyGrantedOn: row?.daily_granted_on || null,
    };
}

async function getWallet(conn, userId, { forUpdate = false } = {}) {
    await ensureWallet(conn, userId);
    const [rows] = await conn.query(
        `SELECT user_id, balance, daily_balance, purchased_balance, lifetime_earned, lifetime_spent,
                DATE_FORMAT(daily_granted_on, '%Y-%m-%d') AS daily_granted_on
         FROM tam24_ai_wallets WHERE user_id = ? ${forUpdate ? 'FOR UPDATE' : ''}`,
        [userId]
    );
    return shape(rows[0]);
}

async function writeBuckets(conn, userId, daily, purchased, { earned = 0, spent = 0, grantedOn } = {}) {
    await conn.query(
        `UPDATE tam24_ai_wallets
            SET daily_balance = ?, purchased_balance = ?, balance = ?,
                lifetime_earned = lifetime_earned + ?, lifetime_spent = lifetime_spent + ?,
                ${grantedOn ? 'daily_granted_on = ?, last_daily_refill_date = ?,' : ''}
                updated_at = NOW()
          WHERE user_id = ?`,
        grantedOn
            ? [daily, purchased, daily + purchased, earned, spent, grantedOn, grantedOn, userId]
            : [daily, purchased, daily + purchased, earned, spent, userId]
    );
}

async function writeLedger(conn, {
    userId, type, dailyDelta = 0, purchasedDelta = 0, before, after, reason,
    referenceType = null, referenceId = null, operationType = null, conversationId = null, messageId = null, metadata = null,
}) {
    await conn.query(
        `INSERT INTO tam24_ai_coin_transactions
         (user_id, type, amount, daily_delta, purchased_delta, balance_before, balance_after, reason,
          reference_type, reference_id, operation_type, conversation_id, message_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId, type, dailyDelta + purchasedDelta, dailyDelta, purchasedDelta, before, after, reason,
            referenceType, referenceId == null ? null : String(referenceId), operationType, conversationId, messageId,
            metadata ? JSON.stringify(metadata) : null,
        ]
    );
}

/** Split a debit across buckets: daily first, then purchased. */
function splitDebit(daily, purchased, amount) {
    const fromDaily = Math.min(daily, amount);
    const fromPurchased = Math.min(purchased, amount - fromDaily);
    return { fromDaily, fromPurchased, covered: fromDaily + fromPurchased };
}

async function withConnection(dbOrConn, fn) {
    const owns = typeof dbOrConn.getConnection === 'function';
    const conn = owns ? await dbOrConn.getConnection() : dbOrConn;
    try {
        if (owns) await conn.beginTransaction();
        const result = await fn(conn);
        if (owns) await conn.commit();
        return result;
    } catch (err) {
        if (owns) { try { await conn.rollback(); } catch { /* ignore */ } }
        throw err;
    } finally {
        if (owns) conn.release();
    }
}

/**
 * Idempotent daily grant. On the first call of a new local day: expire what
 * is left of yesterday's daily bucket, then grant today's quota. The unique
 * key (user_id, type, reference_id=YYYY-MM-DD) makes this race-safe.
 */
async function applyDailyGrant(dbOrConn, userId, planKey) {
    return withConnection(dbOrConn, async (conn) => {
        const w = await getWallet(conn, userId, { forUpdate: true });
        const today = localDateString(new Date());
        if (w.dailyGrantedOn && localDateString(w.dailyGrantedOn) === today) {
            return { granted: false, amount: 0, expired: 0, wallet: w };
        }

        const quota = dailyCoinsForPlan(planKey);
        const expired = w.daily;
        const nextDaily = quota;

        try {
            if (expired > 0) {
                await writeLedger(conn, {
                    userId, type: LEDGER.DAILY_EXPIRE, dailyDelta: -expired,
                    before: w.total, after: w.total - expired,
                    reason: 'انقضای سکه‌های روزانه‌ی استفاده‌نشده',
                    referenceType: 'daily', referenceId: today, metadata: { plan: planKey || 'free' },
                });
            }
            await writeLedger(conn, {
                userId, type: LEDGER.DAILY_GRANT, dailyDelta: quota,
                before: w.total - expired, after: w.purchased + quota,
                reason: `سکه‌ی روزانه‌ی پلن ${planKey || 'free'}`,
                referenceType: 'daily', referenceId: today, metadata: { plan: planKey || 'free', quota },
            });
        } catch (err) {
            if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
                return { granted: false, amount: 0, expired: 0, wallet: await getWallet(conn, userId) };
            }
            throw err;
        }

        await writeBuckets(conn, userId, nextDaily, w.purchased, { earned: quota, grantedOn: today });
        return { granted: quota > 0, amount: quota, expired, wallet: await getWallet(conn, userId) };
    });
}

/** Reserve coins before an AI call. Throws INSUFFICIENT_COINS. */
async function reserveCoins(conn, userId, amount, referenceId, { operationType = 'chat', conversationId = null } = {}) {
    const want = Math.max(1, n(amount) || COIN_PRICING.defaultReservation);
    const w = await getWallet(conn, userId, { forUpdate: true });
    if (w.total < COIN_PRICING.minBalanceToStart) throw insufficient(w.total);

    const { fromDaily, fromPurchased, covered } = splitDebit(w.daily, w.purchased, Math.min(w.total, want));
    if (covered < COIN_PRICING.minCharge) throw insufficient(w.total);

    await writeBuckets(conn, userId, w.daily - fromDaily, w.purchased - fromPurchased);
    await writeLedger(conn, {
        userId, type: LEDGER.RESERVATION, dailyDelta: -fromDaily, purchasedDelta: -fromPurchased,
        before: w.total, after: w.total - covered,
        reason: 'رزرو موقت برای پاسخ مِت', referenceType: 'ai_reservation', referenceId,
        operationType, conversationId, metadata: { reserved: covered },
    });

    return {
        reserved: covered,
        reservedDaily: fromDaily,
        reservedPurchased: fromPurchased,
        balance: w.total - covered,
        wallet: { daily: w.daily - fromDaily, purchased: w.purchased - fromPurchased, total: w.total - covered },
    };
}

/**
 * Settle a reservation against the real cost. The reservation is released
 * back into the buckets it came from, then the actual cost is charged
 * daily-first. Two ledger rows keep the audit trail explicit.
 */
async function finalizeCharge(conn, userId, {
    reserved, reservedDaily = null, reservedPurchased = null, finalCost, referenceId,
    operationType = 'chat', conversationId = null, messageId = null, metadata = null,
}) {
    const w = await getWallet(conn, userId, { forUpdate: true });
    const reservedAmt = n(reserved);
    const rDaily = reservedDaily == null ? reservedAmt : n(reservedDaily);
    const rPurch = reservedPurchased == null ? Math.max(0, reservedAmt - rDaily) : n(reservedPurchased);
    const cost = Math.max(COIN_PRICING.minCharge, Math.ceil(Number(finalCost) || 0));

    let daily = w.daily + rDaily;
    let purchased = w.purchased + rPurch;
    const afterRelease = daily + purchased;

    if (reservedAmt > 0) {
        await writeLedger(conn, {
            userId, type: LEDGER.RESERVATION_RELEASE, dailyDelta: rDaily, purchasedDelta: rPurch,
            before: w.total, after: afterRelease,
            reason: 'آزادسازی رزرو', referenceType: 'ai_reservation', referenceId,
            operationType, conversationId, messageId, metadata: { reserved: reservedAmt, finalCost: cost },
        });
    }

    const { fromDaily, fromPurchased, covered } = splitDebit(daily, purchased, cost);
    daily -= fromDaily;
    purchased -= fromPurchased;

    await writeBuckets(conn, userId, daily, purchased, { spent: covered });
    await writeLedger(conn, {
        userId, type: LEDGER.AI_USAGE, dailyDelta: -fromDaily, purchasedDelta: -fromPurchased,
        before: afterRelease, after: daily + purchased,
        reason: 'هزینه‌ی پاسخ مِت', referenceType: 'ai_message', referenceId,
        operationType, conversationId, messageId,
        metadata: { ...(metadata || {}), reserved: reservedAmt, finalCost: cost, shortfall: cost - covered },
    });

    return {
        charged: covered,
        chargedDaily: fromDaily,
        chargedPurchased: fromPurchased,
        refunded: Math.max(0, reservedAmt - covered),
        balance: daily + purchased,
        wallet: { daily, purchased, total: daily + purchased },
    };
}

/** Return a reservation untouched (generation failed / was stopped before any cost). */
async function refundReservation(dbOrConn, userId, reservation, referenceId, reason = 'بازگشت رزرو به دلیل خطا') {
    const reservedAmt = typeof reservation === 'object' ? n(reservation.reserved) : n(reservation);
    const rDaily = typeof reservation === 'object' && reservation.reservedDaily != null ? n(reservation.reservedDaily) : reservedAmt;
    const rPurch = typeof reservation === 'object' && reservation.reservedPurchased != null ? n(reservation.reservedPurchased) : 0;

    return withConnection(dbOrConn, async (conn) => {
        const w = await getWallet(conn, userId, { forUpdate: true });
        if (reservedAmt <= 0) return { refunded: 0, balance: w.total, wallet: w };

        const daily = w.daily + rDaily;
        const purchased = w.purchased + rPurch;
        await writeBuckets(conn, userId, daily, purchased);
        await writeLedger(conn, {
            userId, type: LEDGER.REFUND, dailyDelta: rDaily, purchasedDelta: rPurch,
            before: w.total, after: daily + purchased,
            reason, referenceType: 'ai_reservation', referenceId, metadata: { reserved: reservedAmt },
        });
        return { refunded: reservedAmt, balance: daily + purchased, wallet: { daily, purchased, total: daily + purchased } };
    });
}

/** Flat debit for fixed-price operations (STT, TTS, PDF indexing). Throws INSUFFICIENT_COINS. */
async function chargeFlat(dbOrConn, userId, amount, {
    reason, referenceType = 'ai_operation', referenceId, operationType = null, conversationId = null, messageId = null, metadata = null,
} = {}) {
    const cost = Math.ceil(Math.max(0, Number(amount) || 0));
    return withConnection(dbOrConn, async (conn) => {
        const w = await getWallet(conn, userId, { forUpdate: true });
        if (cost === 0) return { charged: 0, balance: w.total, wallet: w };
        if (w.total < cost) throw insufficient(w.total);

        const { fromDaily, fromPurchased } = splitDebit(w.daily, w.purchased, cost);
        const daily = w.daily - fromDaily;
        const purchased = w.purchased - fromPurchased;
        await writeBuckets(conn, userId, daily, purchased, { spent: cost });
        await writeLedger(conn, {
            userId, type: LEDGER.AI_USAGE, dailyDelta: -fromDaily, purchasedDelta: -fromPurchased,
            before: w.total, after: daily + purchased,
            reason: reason || 'هزینه‌ی سرویس', referenceType,
            referenceId: referenceId ?? `${operationType || 'op'}-${Date.now()}`,
            operationType, conversationId, messageId, metadata,
        });
        return { charged: cost, balance: daily + purchased, wallet: { daily, purchased, total: daily + purchased } };
    });
}

/** Credit purchased coins (payments, bonuses, admin adjustments). Idempotent per (type, referenceId). */
async function creditPurchased(dbOrConn, userId, amount, { type = LEDGER.PURCHASE, reason, referenceType = 'payment', referenceId, metadata = null } = {}) {
    const amt = n(amount);
    if (amt <= 0) throw new Error('INVALID_AMOUNT');
    if (![LEDGER.PURCHASE, LEDGER.BONUS, LEDGER.ADMIN_ADJUSTMENT].includes(type)) throw new Error('INVALID_LEDGER_TYPE');
    return withConnection(dbOrConn, async (conn) => {
        const w = await getWallet(conn, userId, { forUpdate: true });
        try {
            await writeLedger(conn, {
                userId, type, purchasedDelta: amt, before: w.total, after: w.total + amt,
                reason: reason || 'شارژ سکه', referenceType, referenceId: referenceId ?? `${type}-${Date.now()}`, metadata,
            });
        } catch (err) {
            if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
                return { credited: 0, duplicate: true, balance: w.total, wallet: w };
            }
            throw err;
        }
        await writeBuckets(conn, userId, w.daily, w.purchased + amt, { earned: amt });
        return { credited: amt, duplicate: false, balance: w.total + amt, wallet: { daily: w.daily, purchased: w.purchased + amt, total: w.total + amt } };
    });
}

/** Credit or debit coins as an admin. Positive delta adds purchased coins; negative spends daily then purchased. */
async function adminAdjust(dbOrConn, userId, delta, { reason, adminId, referenceId } = {}) {
    const amt = Math.trunc(Number(delta) || 0);
    if (!amt) {
        const err = new Error('INVALID_AMOUNT');
        err.code = 'INVALID_AMOUNT';
        throw err;
    }
    if (amt > 0) {
        return creditPurchased(dbOrConn, userId, amt, {
            type: LEDGER.ADMIN_ADJUSTMENT,
            reason: reason || 'افزایش سکه توسط ادمین',
            referenceType: 'admin',
            referenceId: referenceId || `admin-${adminId || 'x'}-${Date.now()}`,
            metadata: { adminId },
        });
    }
    return withConnection(dbOrConn, async (conn) => {
        const w = await getWallet(conn, userId, { forUpdate: true });
        const cost = Math.abs(amt);
        if (w.total < cost) throw insufficient(w.total);
        const { fromDaily, fromPurchased } = splitDebit(w.daily, w.purchased, cost);
        await writeBuckets(conn, userId, w.daily - fromDaily, w.purchased - fromPurchased, { spent: cost });
        await writeLedger(conn, {
            userId, type: LEDGER.ADMIN_ADJUSTMENT, dailyDelta: -fromDaily, purchasedDelta: -fromPurchased,
            before: w.total, after: w.total - cost,
            reason: reason || 'کاهش سکه توسط ادمین',
            referenceType: 'admin',
            referenceId: referenceId || `admin-${adminId || 'x'}-${Date.now()}`,
            metadata: { adminId },
        });
        return {
            credited: -cost,
            balance: w.total - cost,
            wallet: { daily: w.daily - fromDaily, purchased: w.purchased - fromPurchased, total: w.total - cost },
        };
    });
}

async function listLedger(db, userId, { limit = 30, offset = 0 } = {}) {
    const [rows] = await db.query(
        `SELECT id, type, amount, daily_delta, purchased_delta, balance_before, balance_after, reason,
                operation_type, conversation_id, message_id, created_at
         FROM tam24_ai_coin_transactions
         WHERE user_id = ? AND type <> 'reservation' AND type <> 'reservation_release'
         ORDER BY id DESC LIMIT ? OFFSET ?`,
        [userId, Math.min(100, Math.max(1, Number(limit) || 30)), Math.max(0, Number(offset) || 0)]
    );
    return rows;
}

function quoteMessageCost(opts) {
    return pricing.quoteUsage(opts);
}

module.exports = {
    LEDGER,
    ensureWallet,
    getWallet,
    applyDailyGrant,
    reserveCoins,
    finalizeCharge,
    refundReservation,
    chargeFlat,
    creditPurchased,
    adminAdjust,
    listLedger,
    quoteMessageCost,
    splitDebit,
    // Legacy alias
    applyDailyRefill: applyDailyGrant,
};
