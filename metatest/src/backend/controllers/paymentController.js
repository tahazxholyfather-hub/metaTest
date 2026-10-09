const crypto = require('crypto');
const pool = require('../db');
const zarinpal = require('../utils/zarinpal');
const walletController = require('./walletController');
const { COIN_PACKAGES, coinPackageById } = require('../subscription/limits');
const entitlements = require('../subscription/entitlements');
const usage = require('../subscription/usage');
const coinWallet = require('../ai-teacher/services/coinWallet');
const policy = require('../subscription/policy');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        null
    );
}

function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

/**
 * Prices in DB are in Toman.
 * ZarinPal requires Rial → multiply by 10.
 */
function toRial(toman) {
    return Math.round(Number(toman) * 10);
}

function calculatePricing(plan, coupon, loyaltyPercent = 0) {
    return policy.calculatePricing(plan, coupon, loyaltyPercent);
}

function rejectUnbuyablePlan(plan) {
    if (!plan || Number(plan.is_active) !== 1) return 'پلن معتبر نیست';
    if (Number(plan.purchasable) === 0) return 'این اشتراک فعلاً قابل خرید نیست';
    return null;
}

function describePurchase(plan, pricing, suffix) {
    const loyalty = Number(pricing.loyaltyPercent) > 0 ? ` - تخفیف وفاداری ${pricing.loyaltyPercent}٪` : '';
    return `اشتراک ${plan.name}${suffix || ''}${loyalty}`;
}

function loyaltyPayload(pricing, loyalty) {
    return {
        loyaltyPercent: pricing.loyaltyPercent || 0,
        loyaltyDiscountAmount: pricing.loyaltyDiscountAmount || 0,
        loyaltyFromPlan: loyalty?.fromPlanId || null,
    };
}

function getPaymentResultSecret() {
    return process.env.PAYMENT_RESULT_SECRET || process.env.JWT_SECRET || 'change-me-payment-result-secret';
}

function base64UrlEncode(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
    const normalized = String(value)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signTokenPayload(payload) {
    return crypto
        .createHmac('sha256', getPaymentResultSecret())
        .update(payload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function createPaymentResultToken(paymentId) {
    const payload = JSON.stringify({
        paymentId: Number(paymentId),
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    const encodedPayload = base64UrlEncode(payload);
    const signature = signTokenPayload(encodedPayload);

    return `${encodedPayload}.${signature}`;
}

function verifyPaymentResultToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        throw new Error('Invalid token format');
    }

    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
        throw new Error('Invalid token');
    }

    const expectedSignature = signTokenPayload(encodedPayload);

    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        throw new Error('Invalid token signature');
    }

    const decodedPayload = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(decodedPayload);

    if (!payload.paymentId || Number(payload.paymentId) <= 0) {
        throw new Error('Invalid payment token payload');
    }

    if (!payload.exp || Date.now() > Number(payload.exp)) {
        throw new Error('Payment token expired');
    }

    return Number(payload.paymentId);
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

async function fetchActivePlan(connection, planId) {
    const [rows] = await connection.execute(
        `SELECT id, name, days, price, plan_discount_percent, is_active, purchasable
         FROM subscription_plans
         WHERE id = ?
         LIMIT 1`,
        [planId]
    );
    return rows[0] || null;
}

async function fetchCoupon(connection, code, { forUpdate = false } = {}) {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) return null;

    const [rows] = await connection.execute(
        `SELECT id, code, percent, active, expires_at, max_uses, used_count, allowed_plan_ids
         FROM discount_codes
         WHERE UPPER(code) = UPPER(?)
         LIMIT 1
         ${forUpdate ? 'FOR UPDATE' : ''}`,
        [normalizedCode]
    );
    return rows[0] || null;
}

function validateCouponForPlan(coupon, planId) {
    if (!coupon) return { valid: true };

    if (!coupon.active) {
        return { valid: false, message: 'کد تخفیف معتبر نیست' };
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { valid: false, message: 'کد تخفیف منقضی شده است' };
    }

    if (coupon.max_uses !== null && coupon.max_uses !== undefined) {
        if (Number(coupon.used_count) >= Number(coupon.max_uses)) {
            return { valid: false, message: 'ظرفیت استفاده از این کد تکمیل شده است' };
        }
    }

    const allowedPlanIds = safeJsonParse(coupon.allowed_plan_ids, null);
    if (Array.isArray(allowedPlanIds) && allowedPlanIds.length > 0) {
        const planKey = String(planId);
        const matches = allowedPlanIds.map(String).includes(planKey);
        if (!matches) {
            return { valid: false, message: 'این کد برای پلن انتخابی قابل استفاده نیست' };
        }
    }

    return { valid: true };
}

async function userAlreadyUsedCoupon(connection, userId, couponId) {
    if (!userId || !couponId) return false;
    const [rows] = await connection.execute(
        `SELECT id FROM payments
         WHERE user_id = ? AND discount_code_id = ? AND status = 'paid'
         LIMIT 1`,
        [userId, couponId]
    );
    return rows.length > 0;
}

async function lockUser(connection, userId) {
    const [rows] = await connection.execute(
        `SELECT id, current_plan, plan_expires_at
         FROM tam24_users
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [userId]
    );
    return rows[0] || null;
}

async function createPaidPaymentRecord(connection, payload) {
    const [result] = await connection.execute(
        `INSERT INTO payments (
            user_id,
            plan_id,
            discount_code_id,
            base_price,
            plan_discount_percent,
            plan_discount_amount,
            price_after_plan_discount,
            coupon_percent,
            coupon_discount_amount,
            final_price,
            currency,
            status,
            gateway,
            description,
            request_payload,
            client_ip,
            user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.userId,
            payload.planId,
            payload.discountCodeId,
            payload.basePrice,
            payload.planDiscountPercent,
            payload.planDiscountAmount,
            payload.priceAfterPlanDiscount,
            payload.couponPercent,
            payload.couponDiscountAmount,
            payload.finalPrice,
            payload.currency,
            payload.status,
            payload.gateway,
            payload.description,
            JSON.stringify(payload.requestPayload || null),
            payload.clientIp,
            payload.userAgent,
        ]
    );
    return result.insertId;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/** Visible shop rows, purchasable flag, queue and loyalty settings. Runs once per process. */
exports.ensureDiamondPlanActive = () => policy.ensureSubscriptionCatalog();

exports.getSubscriptionPlans = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await policy.ensureSubscriptionCatalog();
        if (req.user?.id) {
            try { await policy.promoteDueReservations(req.user.id); } catch (err) {
                console.error('[plans] promote', err.message);
            }
        }
        const [rows] = await connection.execute(
            `SELECT
                 id, name, days, price, plan_discount_percent, purchasable,
                 icon_primary, icon_secondary, shimmer_class,
                 active_shadow, active_border, popular
             FROM subscription_plans
             WHERE is_active = 1
             ORDER BY sort_order ASC, price ASC`
        );

        const loyalty = req.user?.id
            ? await policy.loyaltyContext(connection, req.user.id)
            : { open: false, queueEnabled: (await policy.loadSettings(connection)).queueEnabled, rules: {}, hoursLeft: null, fromPlanName: null, enabled: false, windowHours: 72 };
        const plans = rows.map((row) => policy.publicPlan(row, loyalty.rules?.[row.id]));

        return res.json({
            success: true,
            data: plans,
            meta: {
                queueEnabled: loyalty.queueEnabled !== false,
                loyaltyOpen: Boolean(loyalty.open),
                loyaltyFromPlanName: loyalty.fromPlanName || null,
                loyaltyHoursLeft: loyalty.hoursLeft,
                loyaltyWindowHours: loyalty.windowHours,
            },
        });
    } catch (error) {
        console.error('getSubscriptionPlans error:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت پلن‌ها' });
    } finally {
        connection.release();
    }
};

exports.validateDiscountCode = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { code, planId } = req.body;

        if (!planId) {
            return res.status(400).json({ success: false, message: 'پلن انتخاب نشده است' });
        }

        const plan = await fetchActivePlan(connection, planId);
        const block = rejectUnbuyablePlan(plan);
        if (block) {
            return res.status(400).json({ success: false, message: block });
        }

        const coupon = await fetchCoupon(connection, code);
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'کد تخفیف معتبر نیست' });
        }

        const validation = validateCouponForPlan(coupon, planId);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }

        if (req.user?.id && await userAlreadyUsedCoupon(connection, req.user.id, coupon.id)) {
            return res.status(400).json({ success: false, message: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید' });
        }

        const loyalty = req.user?.id ? await policy.loyaltyContext(connection, req.user.id) : { rules: {} };
        const pricing = calculatePricing(plan, coupon, loyalty.rules?.[plan.id]);

        return res.json({
            success: true,
            message: 'کد تخفیف معتبر است',
            data: {
                coupon: {
                    id: coupon.id,
                    code: coupon.code,
                    percent: Number(coupon.percent),
                },
                pricing,
            },
        });
    } catch (error) {
        console.error('validateDiscountCode error:', error);
        return res.status(500).json({ success: false, message: 'خطا در بررسی کد تخفیف' });
    } finally {
        connection.release();
    }
};

exports.createSubscriptionPayment = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user.id;
        const { planId, discountCode, metadata } = req.body;

        if (!planId) {
            return res.status(400).json({ success: false, message: 'پلن انتخاب نشده است' });
        }

        const plan = await fetchActivePlan(connection, planId);
        const block = rejectUnbuyablePlan(plan);
        if (block) {
            return res.status(400).json({ success: false, message: block });
        }

        await connection.beginTransaction();

        const gate = await policy.assertCanPurchase(connection, userId);
        if (!gate.ok) {
            await connection.rollback();
            return res.status(gate.status || 400).json({ success: false, message: gate.message });
        }

        let coupon = null;
        if (discountCode && String(discountCode).trim()) {
            coupon = await fetchCoupon(connection, discountCode, { forUpdate: true });

            if (!coupon) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'کد تخفیف معتبر نیست' });
            }

            const validation = validateCouponForPlan(coupon, planId);
            if (!validation.valid) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: validation.message });
            }

            if (await userAlreadyUsedCoupon(connection, userId, coupon.id)) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید' });
            }
        }

        const loyalty = await policy.loyaltyContext(connection, userId);
        const pricing = calculatePricing(plan, coupon, loyalty.rules?.[plan.id]);

        // ---- Pay with Toman wallet (no ZarinPal redirect) ----
        if (req.body.paymentMethod === 'wallet') {
            if (pricing.finalPrice <= 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'این پلن رایگان است و نیازی به پرداخت ندارد.' });
            }

            try {
                await walletController.debitTomanWallet(connection, userId, pricing.finalPrice, {
                    type: 'purchase',
                    description: `خرید اشتراک ${plan.name} از کیف پول`,
                    referenceType: 'payment',
                });
            } catch (err) {
                await connection.rollback();
                if (err && err.code === 'INSUFFICIENT_BALANCE') {
                    return res.status(400).json({ success: false, message: err.message });
                }
                throw err;
            }

            const walletPaymentId = await createPaidPaymentRecord(connection, {
                userId,
                planId: plan.id,
                discountCodeId: coupon ? coupon.id : null,
                ...pricing,
                currency: 'IRR',
                status: 'paid',
                gateway: 'wallet',
                description: describePurchase(plan, pricing, ' - پرداخت با کیف پول'),
                requestPayload: { planId, discountCode: discountCode || null, metadata: metadata || null, paymentMethod: 'wallet', ...loyaltyPayload(pricing, loyalty) },
                clientIp: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
            });

            const walletAssignment = await policy.applyPaidPlan(connection, {
                userId,
                plan,
                paymentId: walletPaymentId,
            });

            if (coupon) {
                await connection.execute(
                    `UPDATE discount_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
                    [coupon.id]
                );
            }

            await connection.execute(
                `UPDATE payments SET paid_at = NOW(), verified_at = NOW(), updated_at = NOW() WHERE id = ?`,
                [walletPaymentId]
            );

            await connection.commit();

            // Referral reward for the inviter (first purchase only) — post-commit.
            await walletController.awardReferralRewardForPayment(walletPaymentId);

            const walletResultToken = createPaymentResultToken(walletPaymentId);
            return res.json({
                success: true,
                message: walletAssignment.queued
                    ? 'پلن در صف رزرو ثبت شد و پس از پایان اشتراک فعلی فعال می‌شود.'
                    : 'پلن با موفقیت با کیف پول فعال شد',
                data: {
                    directActivated: true,
                    queued: walletAssignment.queued,
                    walletPaid: true,
                    paymentId: walletPaymentId,
                    resultToken: walletResultToken,
                    resultUrl: `/payment/result/${walletResultToken}`,
                    plan: { id: plan.id, name: plan.name, days: plan.days, unlimited: plan.days == null },
                    pricing,
                    startsAt: walletAssignment.startsAt,
                    expiresAt: walletAssignment.queued ? walletAssignment.endsAt : walletAssignment.expiresAt,
                },
            });
        }

        if (pricing.finalPrice <= 0) {
            const user = await lockUser(connection, userId);
            if (!user) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
            }

            const paymentId = await createPaidPaymentRecord(connection, {
                userId,
                planId: plan.id,
                discountCodeId: coupon ? coupon.id : null,
                ...pricing,
                currency: 'IRR',
                status: 'paid',
                gateway: 'zarinpal',
                description: describePurchase(plan, pricing, ' - فعال‌سازی مستقیم'),
                requestPayload: {
                    planId,
                    discountCode: discountCode || null,
                    metadata: metadata || null,
                    directActivation: true,
                    ...loyaltyPayload(pricing, loyalty),
                },
                clientIp: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
            });

            const directAssignment = await policy.applyPaidPlan(connection, {
                userId,
                plan,
                paymentId,
            });

            if (coupon) {
                const [usedResult] = await connection.execute(
                    `UPDATE discount_codes
                     SET used_count = used_count + 1, updated_at = NOW()
                     WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
                    [coupon.id]
                );
                if (!usedResult.affectedRows) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'ظرفیت استفاده از این کد تکمیل شده است' });
                }
            }

            await connection.execute(
                `UPDATE payments
                 SET paid_at = NOW(), verified_at = NOW(), updated_at = NOW()
                 WHERE id = ?`,
                [paymentId]
            );

            await connection.commit();

            const resultToken = createPaymentResultToken(paymentId);

            return res.json({
                success: true,
                message: directAssignment.queued
                    ? 'پلن در صف رزرو ثبت شد و پس از پایان اشتراک فعلی فعال می‌شود.'
                    : 'پلن با موفقیت فعال شد',
                data: {
                    directActivated: true,
                    queued: directAssignment.queued,
                    paymentId,
                    resultToken,
                    resultUrl: `/payment/result/${resultToken}`,
                    plan: { id: plan.id, name: plan.name, days: plan.days, unlimited: plan.days == null },
                    pricing,
                    startsAt: directAssignment.startsAt,
                    expiresAt: directAssignment.queued ? directAssignment.endsAt : directAssignment.expiresAt,
                },
            });
        }

        const paymentId = await createPaidPaymentRecord(connection, {
            userId,
            planId: plan.id,
            discountCodeId: coupon ? coupon.id : null,
            ...pricing,
            currency: 'IRR',
            status: 'pending',
            gateway: 'zarinpal',
            description: describePurchase(plan, pricing),
            requestPayload: {
                planId,
                discountCode: discountCode || null,
                metadata: metadata || null,
                ...loyaltyPayload(pricing, loyalty),
            },
            clientIp: getClientIp(req),
            userAgent: req.headers['user-agent'] || null,
        });

        const baseUrl = String(process.env.BASE_URL || '').replace(/\/+$/, '');
        const callbackUrl = `${baseUrl}/api/payments/zarinpal/callback?paymentId=${paymentId}`;

        const mobile = metadata?.mobile || req.user.phone;
        const email = metadata?.email || req.user.email;

        const amountInRial = toRial(pricing.finalPrice);

        const paymentRequest = await zarinpal.payments.create({
            amount: amountInRial,
            currency: 'IRR',
            callback_url: callbackUrl,
            description: `اشتراک ${plan.name} - user:${userId} - payment:${paymentId}`,
            ...(mobile ? { mobile } : {}),
            ...(email ? { email } : {}),
        });

        const requestData = paymentRequest?.data;
        const requestCode = requestData?.code;
        const authority = requestData?.authority || null;

        if (requestCode !== 100 || !authority) {
            throw new Error(
                `Unexpected Zarinpal payment request response: ${JSON.stringify(paymentRequest)}`
            );
        }

        const paymentUrl = await zarinpal.payments.getRedirectUrl(authority);
        if (!paymentUrl) {
            throw new Error(`Zarinpal did not return a redirect URL for authority: ${authority}`);
        }

        await connection.execute(
            `UPDATE payments
             SET authority = ?, gateway_response = ?, updated_at = NOW()
             WHERE id = ?`,
            [authority, JSON.stringify(paymentRequest), paymentId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: 'درخواست پرداخت ایجاد شد',
            data: {
                paymentId,
                authority,
                paymentUrl,
                plan: { id: plan.id, name: plan.name, days: plan.days },
                pricing,
            },
        });
    } catch (error) {
        try { await connection.rollback(); } catch (_) { /* no open transaction */ }
        if (error && error.expose) {
            return res.status(error.status || 400).json({ success: false, message: error.message });
        }
        console.error('createSubscriptionPayment error:', error);

        if (error.response) {
            console.error('ZarinPal Response Status:', error.response.status);
            console.error('ZarinPal Response Headers:', error.response.headers);
            console.error('ZarinPal Response Body:', JSON.stringify(error.response.data, null, 2));
        }

        return res.status(500).json({ success: false, message: 'خطا در ایجاد پرداخت' });
    } finally {
        connection.release();
    }
};

exports.handleZarinpalCallback = async (req, res) => {
    if (req.query.coinPurchaseId) {
        return handleCoinPurchaseCallback(req, res);
    }
    const connection = await pool.getConnection();

    const frontendBase = String(process.env.FRONTEND_URL || process.env.BASE_URL || '').replace(/\/+$/, '');
    const redirectToResult = (paymentId) => {
        const token = createPaymentResultToken(paymentId);
        return res.redirect(`${frontendBase}/payment/result/${token}`);
    };

    try {
        const paymentId = Number(req.query.paymentId);
        const authorityFromCb = req.query.Authority || null;
        const statusFromCb = req.query.Status || null;

        if (!paymentId) {
            return res.status(400).send('paymentId is required');
        }

        const [paymentRows] = await connection.execute(
            `SELECT * FROM payments WHERE id = ? LIMIT 1`,
            [paymentId]
        );

        const payment = paymentRows[0];
        if (!payment) {
            return res.status(404).send('Payment not found');
        }

        if (payment.status === 'paid') {
            return redirectToResult(paymentId);
        }

        if (statusFromCb !== 'OK') {
            await connection.execute(
                `UPDATE payments
                 SET status = 'cancelled', callback_payload = ?, updated_at = NOW()
                 WHERE id = ? AND status = 'pending'`,
                [JSON.stringify(req.query), paymentId]
            );
            return redirectToResult(paymentId);
        }

        const amountInRial = toRial(Number(payment.final_price));

        const verifyResult = await zarinpal.verifications.verify({
            amount: amountInRial,
            authority: authorityFromCb || payment.authority,
        });

        const verifyData = verifyResult?.data;
        const verifyCode = verifyData?.code ?? null;
        const refId = verifyData?.ref_id ?? null;
        const verifySuccess = verifyCode === 100 || verifyCode === 101;

        if (!verifySuccess) {
            await connection.execute(
                `UPDATE payments
                 SET status = 'failed',
                     verify_response = ?,
                     callback_payload = ?,
                     updated_at = NOW()
                 WHERE id = ? AND status = 'pending'`,
                [JSON.stringify(verifyResult), JSON.stringify(req.query), paymentId]
            );
            return redirectToResult(paymentId);
        }

        await connection.beginTransaction();

        const [lockedPaymentRows] = await connection.execute(
            `SELECT * FROM payments WHERE id = ? LIMIT 1 FOR UPDATE`,
            [paymentId]
        );

        const lockedPayment = lockedPaymentRows[0];
        if (!lockedPayment) {
            await connection.rollback();
            return res.status(404).send('Payment not found');
        }

        if (lockedPayment.status === 'paid') {
            await connection.commit();
            return redirectToResult(paymentId);
        }

        const [planRows] = await connection.execute(
            `SELECT id, name, days FROM subscription_plans WHERE id = ? LIMIT 1`,
            [lockedPayment.plan_id]
        );

        const plan = planRows[0];
        if (!plan) {
            await connection.rollback();
            return res.status(500).send('Plan not found');
        }

        await policy.applyPaidPlan(connection, {
            userId: lockedPayment.user_id,
            plan,
            paymentId,
        });

        if (lockedPayment.discount_code_id) {
            await connection.execute(
                `UPDATE discount_codes
                 SET used_count = used_count + 1, updated_at = NOW()
                 WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
                [lockedPayment.discount_code_id]
            );
        }

        await connection.execute(
            `UPDATE payments
             SET status = 'paid',
                 authority = ?,
                 ref_id = ?,
                 verify_response = ?,
                 callback_payload = ?,
                 paid_at = NOW(),
                 verified_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [
                authorityFromCb || lockedPayment.authority,
                refId,
                JSON.stringify(verifyResult),
                JSON.stringify(req.query),
                paymentId,
            ]
        );

        await connection.commit();

        // Award referral reward for the inviter (first purchase only) — post-commit.
        await walletController.awardReferralRewardForPayment(paymentId);

        return redirectToResult(paymentId);
    } catch (error) {
        await connection.rollback();
        console.error('handleZarinpalCallback error:', error);

        if (error.response) {
            console.error('ZarinPal Verify Response Status:', error.response.status);
            console.error('ZarinPal Verify Response Body:', JSON.stringify(error.response.data, null, 2));
        }

        return res.status(500).send('Callback error');
    } finally {
        connection.release();
    }
};

/**
 * GET /api/payments/result/:token
 * No auth required — token is signed and expires.
 */
exports.getPaymentResult = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const token = req.params.token;
        const paymentId = verifyPaymentResultToken(token);

        const [rows] = await connection.execute(
            `SELECT
                 p.id AS payment_id,
                 p.user_id,
                 p.plan_id,
                 p.discount_code_id,
                 p.base_price,
                 p.plan_discount_percent,
                 p.plan_discount_amount,
                 p.price_after_plan_discount,
                 p.coupon_percent,
                 p.coupon_discount_amount,
                 p.final_price,
                 p.currency,
                 p.status,
                 p.gateway,
                 p.authority,
                 p.ref_id,
                 p.description,
                 p.requested_at,
                 p.paid_at,
                 p.verified_at,
                 p.client_ip,
                 p.user_agent,
                 p.created_at AS payment_created_at,
                 p.updated_at AS payment_updated_at,

                 sp.name AS plan_name,
                 sp.days AS plan_days,

                 u.id AS user_id_ref,
                 u.username,
                 u.email,
                 u.phone,
                 u.first_name,
                 u.last_name,
                 u.avatar_url,
                 u.bio,
                 u.xp_level,
                 u.xp_points,
                 u.trophies,
                 u.current_plan,
                 u.plan_expires_at,
                 u.role,
                 u.status AS user_status,
                 u.last_login,
                 u.last_login_ip,
                 u.created_at AS user_created_at,
                 u.updated_at AS user_updated_at
             FROM payments p
             LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
             LEFT JOIN tam24_users u ON u.id = p.user_id
             WHERE p.id = ?
             LIMIT 1`,
            [paymentId]
        );

        const row = rows[0];
        if (!row) {
            return res.status(404).json({ success: false, message: 'پرداخت یافت نشد' });
        }

        let reservation = null;
        try {
            const [reserved] = await connection.execute(
                `SELECT starts_at, ends_at, status FROM subscription_reservations WHERE payment_id = ? ORDER BY id DESC LIMIT 1`,
                [paymentId]
            );
            reservation = reserved[0] || null;
        } catch (err) {
            if (!err || err.code !== 'ER_NO_SUCH_TABLE') throw err;
        }

        return res.json({
            success: true,
            data: {
                payment: {
                    id: row.payment_id,
                    userId: row.user_id,
                    planId: row.plan_id,
                    discountCodeId: row.discount_code_id,
                    basePrice: Number(row.base_price),
                    planDiscountPercent: Number(row.plan_discount_percent),
                    planDiscountAmount: Number(row.plan_discount_amount),
                    priceAfterPlanDiscount: Number(row.price_after_plan_discount),
                    couponPercent: Number(row.coupon_percent),
                    couponDiscountAmount: Number(row.coupon_discount_amount),
                    finalPrice: Number(row.final_price),
                    currency: row.currency,
                    status: row.status,
                    gateway: row.gateway,
                    authority: row.authority,
                    refId: row.ref_id,
                    description: row.description,
                    requestedAt: row.requested_at,
                    paidAt: row.paid_at,
                    verifiedAt: row.verified_at,
                    clientIp: row.client_ip,
                    userAgent: row.user_agent,
                    createdAt: row.payment_created_at,
                    updatedAt: row.payment_updated_at,
                },
                plan: {
                    id: row.plan_id,
                    name: row.plan_name,
                    days: row.plan_days ? Number(row.plan_days) : null,
                    unlimited: row.plan_days == null,
                    queued: reservation?.status === 'queued',
                    startsAt: reservation?.starts_at || null,
                    endsAt: reservation?.ends_at || null,
                },
                user: row.user_id_ref
                    ? {
                        id: row.user_id_ref,
                        username: row.username,
                        email: row.email,
                        phone: row.phone,
                        firstName: row.first_name,
                        lastName: row.last_name,
                        avatarUrl: row.avatar_url,
                        bio: row.bio,
                        xpLevel: Number(row.xp_level || 0),
                        xpPoints: Number(row.xp_points || 0),
                        trophies: Number(row.trophies || 0),
                        currentPlan: row.current_plan,
                        planExpiresAt: row.plan_expires_at,
                        role: row.role,
                        status: row.user_status,
                        lastLogin: row.last_login,
                        lastLoginIp: row.last_login_ip,
                        createdAt: row.user_created_at,
                        updatedAt: row.user_updated_at,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error('getPaymentResult error:', error);
        return res.status(400).json({
            success: false,
            message: 'لینک نتیجه پرداخت نامعتبر یا منقضی شده است',
        });
    } finally {
        connection.release();
    }
};


exports.getMySubscriptionStatus = async (req, res) => {
    try {
        const data = await policy.subscriptionSnapshot(req.user.id);
        if (!data) return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
        return res.json({ success: true, data });
    } catch (error) {
        console.error('getMySubscriptionStatus error:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت وضعیت اشتراک' });
    }
};

exports.getEntitlements = async (req, res) => {
    try {
        const data = await entitlements.forUser(req.user.id);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('getEntitlements error:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت محدودیت‌های پلن' });
    }
};

exports.getCoinPackages = async (req, res) => {
    try {
        const ent = await entitlements.forUser(req.user.id);
        return res.json({
            success: true,
            data: {
                packages: COIN_PACKAGES,
                canPurchase: ent.canPurchaseCoins,
                isPaid: ent.isPaid,
            },
        });
    } catch (error) {
        console.error('getCoinPackages error:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت بسته‌های سکه' });
    }
};

exports.createCoinPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const ent = await entitlements.forUser(req.user.id);
        if (!ent.canPurchaseCoins) {
            return res.status(403).json({
                success: false,
                code: 'PLAN_REQUIRED',
                message: 'خرید سکه با اشتراک ویژه ممکن است.',
            });
        }
        const pack = coinPackageById(req.body?.packageId);
        if (!pack) {
            return res.status(400).json({ success: false, message: 'بسته سکه نامعتبر است.' });
        }
        await usage.ensureReady();
        const [ins] = await connection.execute(
            `INSERT INTO tam24_coin_purchases (user_id, package_id, coins, price_toman, status) VALUES (?, ?, ?, ?, 'pending')`,
            [req.user.id, pack.id, pack.coins, pack.priceToman]
        );
        const purchaseId = ins.insertId;
        const baseUrl = String(process.env.BASE_URL || '').replace(/\/+$/, '');
        const callbackUrl = `${baseUrl}/api/payments/zarinpal/callback?coinPurchaseId=${purchaseId}`;
        const paymentRequest = await zarinpal.payments.create({
            amount: toRial(pack.priceToman),
            currency: 'IRR',
            callback_url: callbackUrl,
            description: `خرید ${pack.coins} سکه متاتست`,
            metadata: { mobile: req.user.phone, email: req.user.email },
        });
        const authority = paymentRequest?.data?.authority || paymentRequest?.authority;
        if (!authority) {
            await connection.execute(
                `UPDATE tam24_coin_purchases SET status = 'failed' WHERE id = ?`,
                [purchaseId]
            );
            return res.status(502).json({ success: false, message: 'درگاه پرداخت پاسخ نداد.' });
        }
        await connection.execute(
            `UPDATE tam24_coin_purchases SET authority = ? WHERE id = ?`,
            [authority, purchaseId]
        );
        const paymentUrl = await zarinpal.payments.getRedirectUrl(authority);
        return res.json({
            success: true,
            data: { purchaseId, paymentUrl, package: pack },
        });
    } catch (error) {
        console.error('createCoinPayment error:', error);
        return res.status(500).json({ success: false, message: 'خطا در ایجاد پرداخت سکه' });
    } finally {
        connection.release();
    }
};

async function handleCoinPurchaseCallback(req, res) {
    const connection = await pool.getConnection();
    const frontendBase = String(process.env.FRONTEND_URL || process.env.BASE_URL || '').replace(/\/+$/, '');
    const purchaseId = Number(req.query.coinPurchaseId);
    const statusFromCb = req.query.Status || null;
    const authorityFromCb = req.query.Authority || null;
    const redirect = (status) => res.redirect(`${frontendBase}/met?coins=${status}`);
    try {
        await usage.ensureReady();
        const [rows] = await connection.execute(
            `SELECT * FROM tam24_coin_purchases WHERE id = ? LIMIT 1`,
            [purchaseId]
        );
        const purchase = rows[0];
        if (!purchase) return res.status(404).send('Coin purchase not found');
        if (purchase.status === 'paid') return redirect('paid');
        if (statusFromCb !== 'OK') {
            await connection.execute(
                `UPDATE tam24_coin_purchases SET status = 'cancelled' WHERE id = ? AND status = 'pending'`,
                [purchaseId]
            );
            return redirect('cancelled');
        }
        const verifyResult = await zarinpal.verifications.verify({
            amount: toRial(Number(purchase.price_toman)),
            authority: authorityFromCb || purchase.authority,
        });
        const verifyCode = verifyResult?.data?.code ?? null;
        const refId = verifyResult?.data?.ref_id ?? null;
        if (verifyCode !== 100 && verifyCode !== 101) {
            await connection.execute(
                `UPDATE tam24_coin_purchases SET status = 'failed' WHERE id = ? AND status = 'pending'`,
                [purchaseId]
            );
            return redirect('failed');
        }
        await coinWallet.creditPurchased(pool, purchase.user_id, purchase.coins, {
            reason: `خرید بسته ${purchase.package_id}`,
            referenceType: 'coin_purchase',
            referenceId: `coin-purchase:${purchase.id}`,
            metadata: { packageId: purchase.package_id, refId },
        });
        await connection.execute(
            `UPDATE tam24_coin_purchases SET status = 'paid', ref_id = ?, paid_at = NOW(), authority = ? WHERE id = ?`,
            [refId, authorityFromCb || purchase.authority, purchaseId]
        );
        return redirect('paid');
    } catch (error) {
        console.error('handleCoinPurchaseCallback error:', error);
        return res.status(500).send('Callback error');
    } finally {
        connection.release();
    }
}
