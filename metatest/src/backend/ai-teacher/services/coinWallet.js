'use strict';

const { COIN_PRICING, dailyRefillForPlan, localDateString } = require('../config');
const pricing = require('./pricing');

/**
 * Reliable AI coin wallet with ledger + row locking.
 * Never trust the frontend for balance mutations.
 */

async function ensureWallet(conn, userId) {
    await conn.query(
        `INSERT IGNORE INTO tam24_ai_wallets (user_id, balance, lifetime_earned, lifetime_spent)
         VALUES (?, 0, 0, 0)`,
        [userId]
    );
}

async function getWallet(conn, userId, { forUpdate = false } = {}) {
    await ensureWallet(conn, userId);
    const [rows] = await conn.query(
        `SELECT user_id, balance, lifetime_earned, lifetime_spent,
                DATE_FORMAT(last_daily_refill_date, '%Y-%m-%d') AS last_daily_refill_date
         FROM tam24_ai_wallets
         WHERE user_id = ?
         ${forUpdate ? 'FOR UPDATE' : ''}`,
        [userId]
    );
    return rows[0];
}

async function writeTransaction(conn, {
    userId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    reason,
    referenceType = null,
    referenceId = null,
    metadata = null,
}) {
    await conn.query(
        `INSERT INTO tam24_ai_coin_transactions
         (user_id, type, amount, balance_before, balance_after, reason, reference_type, reference_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId,
            type,
            amount,
            balanceBefore,
            balanceAfter,
            reason,
            referenceType,
            referenceId,
            metadata ? JSON.stringify(metadata) : null,
        ]
    );
}

/**
 * Daily energy never stacks above the plan's daily allowance.
 * A new day tops the bar up to `dailyAllowance` and clamps anything over the cap.
 * Example: 100 leftover + 200/day → 200, not 300; after 3 days still 200, not 700.
 */
function nextDailyBalance(currentBalance, dailyAllowance) {
    const cap = Math.max(0, Number(dailyAllowance) || 0);
    const before = Math.max(0, Number(currentBalance) || 0);
    // Fill up to the daily cap; leftover never stacks above it.
    return Math.min(cap, Math.max(before, cap));
}

/**
 * Idempotent daily refill based on subscription plan.
 * reference_id = YYYY-MM-DD prevents double refill via unique key.
 */
async function applyDailyRefill(dbOrConn, userId, planKey) {
    const ownsConnection = typeof dbOrConn.getConnection === 'function';
    const conn = ownsConnection ? await dbOrConn.getConnection() : dbOrConn;

    try {
        if (ownsConnection) await conn.beginTransaction();

        const wallet = await getWallet(conn, userId, { forUpdate: true });
        const todayStr = localDateString(new Date());

        if (wallet.last_daily_refill_date) {
            const lastStr = localDateString(wallet.last_daily_refill_date);
            if (lastStr && lastStr === todayStr) {
                if (ownsConnection) await conn.commit();
                return {
                    refilled: false,
                    balance: wallet.balance,
                    amount: 0,
                    alreadyReceived: true,
                };
            }
        }

        const cap = dailyRefillForPlan(planKey);
        const before = Number(wallet.balance) || 0;
        const after = nextDailyBalance(before, cap);
        const granted = Math.max(0, after - before);
        const delta = after - before;

        await conn.query(
            `UPDATE tam24_ai_wallets
             SET balance = ?, lifetime_earned = lifetime_earned + ?, last_daily_refill_date = ?, updated_at = NOW()
             WHERE user_id = ?`,
            [after, granted, todayStr, userId]
        );

        if (delta !== 0) {
            try {
                await writeTransaction(conn, {
                    userId,
                    type: 'daily_refill',
                    amount: delta,
                    balanceBefore: before,
                    balanceAfter: after,
                    reason: `شارژ روزانه پلن ${planKey || 'free'} (سقف ${cap})`,
                    referenceType: 'daily_refill',
                    referenceId: todayStr,
                    metadata: { plan: planKey || 'free', cap },
                });
            } catch (err) {
                if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
                    const fresh = await getWallet(conn, userId);
                    if (ownsConnection) await conn.commit();
                    return {
                        refilled: false,
                        balance: fresh.balance,
                        amount: 0,
                        alreadyReceived: true,
                    };
                }
                throw err;
            }
        }

        if (ownsConnection) await conn.commit();
        return { refilled: granted > 0, balance: after, amount: granted, alreadyReceived: false };
    } catch (err) {
        if (ownsConnection) await conn.rollback();
        throw err;
    } finally {
        if (ownsConnection) conn.release();
    }
}

/**
 * Reserve coins before AI call (atomic). Throws INSUFFICIENT_COINS.
 */
async function reserveCoins(conn, userId, amount, referenceId) {
    const reserveAmount = Math.max(1, Number(amount) || COIN_PRICING.defaultReservation);
    const wallet = await getWallet(conn, userId, { forUpdate: true });
    const before = Number(wallet.balance) || 0;

    if (before < COIN_PRICING.minBalanceToStart) {
        const err = new Error('موجودی سکه کافی نیست.');
        err.code = 'INSUFFICIENT_COINS';
        err.balance = before;
        throw err;
    }

    const actualReserve = Math.min(before, reserveAmount);
    if (actualReserve < COIN_PRICING.minCharge) {
        const err = new Error('موجودی سکه کافی نیست.');
        err.code = 'INSUFFICIENT_COINS';
        err.balance = before;
        throw err;
    }

    const after = before - actualReserve;

    await conn.query(
        `UPDATE tam24_ai_wallets SET balance = ?, updated_at = NOW() WHERE user_id = ?`,
        [after, userId]
    );

    await writeTransaction(conn, {
        userId,
        type: 'reservation',
        amount: -actualReserve,
        balanceBefore: before,
        balanceAfter: after,
        reason: 'رزرو موقت برای پیام هوش مصنوعی',
        referenceType: 'ai_reservation',
        referenceId: String(referenceId),
        metadata: { reserved: actualReserve },
    });

    return { reserved: actualReserve, balance: after };
}

/**
 * After success: settle final cost against reservation.
 * Balance currently reflects "after reservation".
 * - if cost < reserved → refund difference
 * - if cost > reserved → deduct extra (clamped to available)
 * - record a single ai_message debit of -cost for audit clarity
 */
async function finalizeCharge(conn, userId, {
    reserved,
    finalCost,
    referenceId,
    metadata = null,
}) {
    const wallet = await getWallet(conn, userId, { forUpdate: true });
    const before = Number(wallet.balance) || 0;
    const cost = Math.max(COIN_PRICING.minCharge, Math.ceil(Number(finalCost) || 0));
    const reservedAmt = Math.max(0, Number(reserved) || 0);
    const delta = reservedAmt - cost; // +refund / -extra

    let after = before + delta;
    if (after < 0) after = 0;

    await conn.query(
        `UPDATE tam24_ai_wallets
         SET balance = ?,
             lifetime_spent = lifetime_spent + ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [after, cost, userId]
    );

    if (delta > 0) {
        await writeTransaction(conn, {
            userId,
            type: 'reservation_release',
            amount: delta,
            balanceBefore: before,
            balanceAfter: before + delta,
            reason: 'بازگشت مبلغ رزرو استفاده‌نشده',
            referenceType: 'ai_reservation',
            referenceId: String(referenceId),
            metadata: { reserved: reservedAmt, finalCost: cost },
        });
    } else if (delta < 0) {
        await writeTransaction(conn, {
            userId,
            type: 'ai_message',
            amount: delta,
            balanceBefore: before,
            balanceAfter: after,
            reason: 'هزینه اضافی بیش از رزرو',
            referenceType: 'ai_message',
            referenceId: String(referenceId),
            metadata: { ...(metadata || {}), reserved: reservedAmt, finalCost: cost },
        });
    }

    // Audit row for the effective message cost (informational amount)
    await writeTransaction(conn, {
        userId,
        type: 'ai_message',
        amount: -cost,
        balanceBefore: before + Math.max(0, delta),
        balanceAfter: after,
        reason: 'هزینه نهایی پیام هوش مصنوعی',
        referenceType: 'ai_message',
        referenceId: `${referenceId}:final`,
        metadata: { ...(metadata || {}), reserved: reservedAmt, finalCost: cost },
    });

    return { charged: cost, balance: after, refunded: Math.max(0, delta) };
}

async function refundReservation(conn, userId, reserved, referenceId, reason = 'خطای تولید پاسخ') {
    const amount = Math.max(0, Number(reserved) || 0);
    if (amount <= 0) {
        const wallet = await getWallet(conn, userId);
        return { refunded: 0, balance: wallet.balance };
    }

    const wallet = await getWallet(conn, userId, { forUpdate: true });
    const before = Number(wallet.balance) || 0;
    const after = before + amount;

    await conn.query(
        `UPDATE tam24_ai_wallets SET balance = ?, updated_at = NOW() WHERE user_id = ?`,
        [after, userId]
    );

    await writeTransaction(conn, {
        userId,
        type: 'refund',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        reason,
        referenceType: 'ai_reservation',
        referenceId: String(referenceId),
        metadata: { reserved: amount },
    });

    return { refunded: amount, balance: after };
}

/**
 * Integer energy the student pays. Built from real USD list prices.
 * `modelMultiplier` is ignored — the model id already sets the USD rate.
 * lowCoinMode does not discount money (that would lose API cost); shorter replies do.
 */
function calculateCoinCost({
    inputTokens = 0,
    outputTokens = 0,
    cachedTokens = 0,
    model,
    modelMultiplier,
    teacherMultiplier = 1,
} = {}) {
    const quote = pricing.quoteUsage({
        inputTokens,
        outputTokens,
        cachedTokens,
        model,
        teacherMultiplier: teacherMultiplier || modelMultiplier || 1,
    });
    return quote.energy;
}

function quoteMessageCost(opts) {
    return pricing.quoteUsage(opts);
}

module.exports = {
    ensureWallet,
    getWallet,
    applyDailyRefill,
    reserveCoins,
    finalizeCharge,
    refundReservation,
    calculateCoinCost,
    quoteMessageCost,
    nextDailyBalance,
};
