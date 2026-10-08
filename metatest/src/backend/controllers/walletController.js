// controllers/walletController.js
// Toman wallet + referral (invite) commission + withdrawal requests.
//
// The referral reward is deliberately decoupled from the payment transaction:
// paymentController commits the payment first, then calls
// `awardReferralRewardForPayment(paymentId)` which runs in its own transaction.
// Idempotency is guaranteed by the UNIQUE key on tam24_referral_rewards.payment_id.
const db = require('../db');
const crypto = require('crypto');

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateReferralCode = (userId) => {
    // e.g. MT<userId><6 hex chars> — unique, short, human-shareable.
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `MT${userId}${rand}`;
};

async function ensureReferralCode(conn, userId) {
    const [rows] = await conn.query('SELECT referral_code FROM tam24_users WHERE id = ?', [userId]);
    if (!rows.length) return null;
    if (rows[0].referral_code) return rows[0].referral_code;

    for (let i = 0; i < 6; i++) {
        const code = generateReferralCode(userId);
        try {
            await conn.query(
                'UPDATE tam24_users SET referral_code = ? WHERE id = ? AND referral_code IS NULL',
                [code, userId]
            );
            const [chk] = await conn.query('SELECT referral_code FROM tam24_users WHERE id = ?', [userId]);
            if (chk[0] && chk[0].referral_code === code) return code;
        } catch (err) {
            if (err && err.code === 'ER_DUP_ENTRY') continue; // collision → retry
            throw err;
        }
    }
    return null;
}

async function getReferralSettings(conn) {
    try {
        const [rows] = await conn.query('SELECT * FROM tam24_referral_settings WHERE id = 1 LIMIT 1');
        if (!rows.length) {
            return { reward_type: 'percent', reward_percent: 30, reward_fixed_amount: 0, reward_token_amount: 0, is_active: 1 };
        }
        return rows[0];
    } catch (err) {
        // Table may not exist yet (migration not applied) → fail safe to disabled.
        console.error('getReferralSettings error:', err.message);
        return { reward_type: 'percent', reward_percent: 30, reward_fixed_amount: 0, reward_token_amount: 0, is_active: 0 };
    }
}

// Resolve an inviter from the value stored in referrer_code_submitted.
// That value may be a referral_code, a phone, or a username (backward compatible).
async function resolveInviter(conn, referrerCode) {
    if (!referrerCode) return null;
    const code = String(referrerCode).trim();
    if (!code) return null;
    const [rows] = await conn.query(
        'SELECT id, first_name, last_name, username, phone FROM tam24_users WHERE referral_code = ? OR phone = ? OR username = ? LIMIT 1',
        [code, code, code]
    );
    return rows[0] || null;
}

async function getTomanWallet(conn, userId, forUpdate = false) {
    await conn.query('INSERT IGNORE INTO tam24_toman_wallets (user_id) VALUES (?)', [userId]);
    const [rows] = await conn.query(
        `SELECT user_id, balance, lifetime_earned, lifetime_spent
         FROM tam24_toman_wallets WHERE user_id = ? ${forUpdate ? 'FOR UPDATE' : ''}`,
        [userId]
    );
    return rows[0] || { user_id: userId, balance: 0, lifetime_earned: 0, lifetime_spent: 0 };
}

async function insertTomanTransaction(conn, { userId, type, amount, balanceAfter, description, referenceType, referenceId }) {
    await conn.query(
        `INSERT INTO tam24_toman_transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, type, amount, balanceAfter, description || null, referenceType || null, referenceId || null]
    );
}

async function creditTomanWallet(conn, userId, amount, opts = {}) {
    const w = await getTomanWallet(conn, userId, true);
    const newBalance = Number(w.balance) + Number(amount);
    await conn.query(
        'UPDATE tam24_toman_wallets SET balance = ?, lifetime_earned = lifetime_earned + ?, updated_at = NOW() WHERE user_id = ?',
        [newBalance, amount, userId]
    );
    await insertTomanTransaction(conn, {
        userId, type: opts.type || 'admin_adjustment', amount,
        balanceAfter: newBalance, description: opts.description,
        referenceType: opts.referenceType, referenceId: opts.referenceId,
    });
    return newBalance;
}

async function debitTomanWallet(conn, userId, amount, opts = {}) {
    const w = await getTomanWallet(conn, userId, true);
    const amt = Number(amount);
    if (Number(w.balance) < amt) {
        const err = new Error('موجودی کیف پول کافی نیست');
        err.code = 'INSUFFICIENT_BALANCE';
        throw err;
    }
    const newBalance = Number(w.balance) - amt;
    await conn.query(
        'UPDATE tam24_toman_wallets SET balance = ?, lifetime_spent = lifetime_spent + ?, updated_at = NOW() WHERE user_id = ?',
        [newBalance, amt, userId]
    );
    await insertTomanTransaction(conn, {
        userId, type: opts.type || 'purchase', amount: -amt,
        balanceAfter: newBalance, description: opts.description,
        referenceType: opts.referenceType, referenceId: opts.referenceId,
    });
    return newBalance;
}

// ─── Referral reward (runs AFTER the payment is committed) ──────────────────

async function awardReferralRewardForPayment(paymentId) {
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [payRows] = await conn.query(
            'SELECT user_id, plan_id, final_price, status FROM payments WHERE id = ? LIMIT 1',
            [paymentId]
        );
        const payment = payRows[0];
        if (!payment || payment.status !== 'paid') {
            await conn.commit();
            return null;
        }

        const inviteeId = payment.user_id;

        // Only the FIRST paid purchase (final_price > 0) of the invitee qualifies.
        const [cntRows] = await conn.query(
            `SELECT COUNT(*) AS c FROM payments
             WHERE user_id = ? AND status = 'paid' AND final_price > 0 AND id <> ?`,
            [inviteeId, paymentId]
        );
        if (Number(cntRows[0].c) > 0) {
            await conn.commit();
            return null;
        }

        // Resolve inviter.
        const [inviteeRows] = await conn.query(
            'SELECT id, first_name, last_name, username, phone, referrer_code_submitted FROM tam24_users WHERE id = ?',
            [inviteeId]
        );
        const invitee = inviteeRows[0];
        if (!invitee || !invitee.referrer_code_submitted) {
            await conn.commit();
            return null;
        }
        const inviter = await resolveInviter(conn, invitee.referrer_code_submitted);
        if (!inviter || Number(inviter.id) === Number(inviteeId)) {
            await conn.commit();
            return null;
        }

        const settings = await getReferralSettings(conn);
        if (!settings || !Number(settings.is_active)) {
            await conn.commit();
            return null;
        }

        const base = Number(payment.final_price) || 0;
        const rewardType = settings.reward_type;
        let rewardAmount = 0;

        if (rewardType === 'percent') {
            rewardAmount = Math.round(base * (Number(settings.reward_percent) || 0) / 100);
        } else if (rewardType === 'fixed') {
            rewardAmount = Number(settings.reward_fixed_amount) || 0;
        } else if (rewardType === 'token') {
            rewardAmount = Number(settings.reward_token_amount) || 0;
        }

        if (rewardAmount <= 0) {
            await conn.commit();
            return null;
        }

        // Idempotent insert — UNIQUE(payment_id) guards against double-award.
        try {
            await conn.query(
                `INSERT INTO tam24_referral_rewards
                    (inviter_id, invitee_id, payment_id, plan_id, base_amount, reward_type, reward_percent, reward_amount)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [inviter.id, inviteeId, paymentId, payment.plan_id || null, base,
                    rewardType, Number(settings.reward_percent) || 0, rewardAmount]
            );
        } catch (err) {
            if (err && err.code === 'ER_DUP_ENTRY') {
                await conn.commit();
                return null; // already awarded
            }
            throw err;
        }

        // Credit the right wallet.
        if (rewardType === 'token') {
            await conn.query('INSERT IGNORE INTO tam24_ai_wallets (user_id) VALUES (?)', [inviter.id]);
            await conn.query(
                `UPDATE tam24_ai_wallets
                 SET purchased_balance = purchased_balance + ?, balance = balance + ?,
                     lifetime_earned = lifetime_earned + ?, updated_at = NOW()
                 WHERE user_id = ?`,
                [rewardAmount, rewardAmount, rewardAmount, inviter.id]
            );
        } else {
            await creditTomanWallet(conn, inviter.id, rewardAmount, {
                type: 'referral_reward',
                description: 'پاداش دعوت (اولین خرید دعوت‌شده)',
                referenceType: 'referral_reward',
                referenceId: String(paymentId),
            });
        }

        // Notify the inviter in-app.
        const [planRows] = await conn.query('SELECT name FROM subscription_plans WHERE id = ? LIMIT 1', [payment.plan_id]);
        const planName = planRows[0]?.name || 'پکیج';
        const inviteeName = [invitee.first_name, invitee.last_name].filter(Boolean).join(' ').trim()
            || invitee.username || invitee.phone || 'کاربر';

        let body;
        if (rewardType === 'token') {
            body = `کاربر «${inviteeName}» از طریق دعوت شما ثبت‌نام کرد و پکیج «${planName}» را خرید؛ ${rewardAmount.toLocaleString('fa-IR')} توکن به حساب شما اضافه شد.`;
        } else {
            body = `کاربر «${inviteeName}» از طریق دعوت شما ثبت‌نام کرد و پکیج «${planName}» را خرید؛ ${rewardAmount.toLocaleString('fa-IR')} تومان به کیف پول شما اضافه شد.`;
        }

        await conn.query(
            'INSERT INTO tam24_in_app_messages (user_id, title, body) VALUES (?, ?, ?)',
            [inviter.id, 'پاداش دعوت', body]
        );

        await conn.commit();
        return { inviterId: inviter.id, inviteeId, rewardAmount, rewardType };
    } catch (err) {
        if (conn) await conn.rollback().catch(() => {});
        console.error('awardReferralRewardForPayment error:', err.message);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

// ─── Public handlers (dispatched from /api/flow) ────────────────────────────

// action: get_my_referral_code
const handleGetMyReferralCode = async (req, res) => {
    try {
        const userId = req.user.id;
        const conn = await db.getConnection();
        try {
            const code = await ensureReferralCode(conn, userId);
            conn.release();
            return res.json({
                success: true,
                data: {
                    referralCode: code,
                    inviteUrl: code ? `https://metatest.com/invite/${code}` : null,
                },
            });
        } catch (e) {
            conn.release();
            throw e;
        }
    } catch (error) {
        console.error('get_my_referral_code error:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت کد دعوت.' });
    }
};

// action: get_my_wallet
const handleGetMyWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const wallet = await getTomanWallet(db, userId);

        const [txRows] = await db.query(
            `SELECT id, type, amount, balance_after, description, created_at
             FROM tam24_toman_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
            [userId]
        );

        const [rewardRows] = await db.query(
            `SELECT COALESCE(SUM(reward_amount), 0) AS total
             FROM tam24_referral_rewards WHERE inviter_id = ? AND reward_type <> 'token'`,
            [userId]
        );

        const [pendingWithdrawal] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM tam24_withdrawal_requests
             WHERE user_id = ? AND status = 'pending'`,
            [userId]
        );

        return res.json({
            success: true,
            data: {
                balance: Number(wallet.balance || 0),
                lifetimeEarned: Number(wallet.lifetime_earned || 0),
                lifetimeSpent: Number(wallet.lifetime_spent || 0),
                totalReferralEarned: Number(rewardRows[0]?.total || 0),
                pendingWithdrawal: Number(pendingWithdrawal[0]?.total || 0),
                transactions: (txRows || []).map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: Number(t.amount),
                    balanceAfter: Number(t.balance_after),
                    description: t.description,
                    createdAt: t.created_at,
                })),
            },
        });
    } catch (error) {
        console.error('get_my_wallet error:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت کیف پول.' });
    }
};

// action: request_withdrawal
const handleRequestWithdrawal = async (req, res) => {
    const userId = req.user.id;
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
        return res.json({ success: false, message: 'مبلغ برداشت نامعتبر است.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const wallet = await getTomanWallet(conn, userId, true);
        if (Number(wallet.balance) < amount) {
            await conn.rollback();
            return res.json({ success: false, message: 'موجودی کیف پول کافی نیست.' });
        }

        // Reserve the amount (deduct) so it cannot be double-spent.
        await debitTomanWallet(conn, userId, amount, {
            type: 'withdrawal',
            description: 'درخواست برداشت وجه',
            referenceType: 'withdrawal',
            referenceId: 'pending',
        });

        await conn.query(
            'INSERT INTO tam24_withdrawal_requests (user_id, amount, status) VALUES (?, ?, ?)',
            [userId, amount, 'pending']
        );

        await conn.commit();
        return res.json({
            success: true,
            message: 'درخواست شما ثبت شد؛ کارشناسان ما به‌زودی با شما تماس خواهند گرفت.',
        });
    } catch (error) {
        await conn.rollback().catch(() => {});
        console.error('request_withdrawal error:', error);
        return res.status(500).json({ success: false, message: 'خطا در ثبت درخواست برداشت.' });
    } finally {
        conn.release();
    }
};

module.exports = {
    ensureReferralCode,
    getReferralSettings,
    getTomanWallet,
    creditTomanWallet,
    debitTomanWallet,
    resolveInviter,
    awardReferralRewardForPayment,
    handleGetMyReferralCode,
    handleGetMyWallet,
    handleRequestWithdrawal,
};
