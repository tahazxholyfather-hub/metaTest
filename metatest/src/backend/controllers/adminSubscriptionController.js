'use strict';

const pool = require('../db');
const policy = require('../subscription/policy');

function flag(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

function cleanName(value) {
    const name = String(value || '').trim();
    if (!name || name.length > 80) return null;
    return name;
}

function cleanPrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 1e12) return null;
    return Math.round(price);
}

function cleanDays(value, unlimited) {
    if (unlimited === true || value === null || value === '' || value === undefined) return null;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return undefined;
    return days;
}

function cleanPercent(value) {
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
    return Math.round(percent * 100) / 100;
}

function cleanHours(value) {
    const hours = Number(value);
    if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 90) return null;
    return hours;
}

async function handleGetCatalog(_req, res) {
    await policy.ensureSubscriptionCatalog();
    const [plans] = await pool.query(
        `SELECT id, name, days, price, plan_discount_percent, popular, is_active, purchasable, sort_order
         FROM subscription_plans
         ORDER BY sort_order ASC, price ASC`
    );
    const settings = await policy.loadSettings(pool);
    const [rules] = await pool.query(
        `SELECT from_plan_id, to_plan_id, percent FROM subscription_loyalty_rules`
    );
    return res.json({
        success: true,
        data: {
            plans: plans.map((row) => ({
                id: row.id,
                name: row.name,
                days: row.days == null ? null : Number(row.days),
                unlimited: row.days == null,
                price: Number(row.price),
                popular: Number(row.popular) === 1,
                isActive: Number(row.is_active) === 1,
                purchasable: Number(row.purchasable) !== 0,
                sortOrder: Number(row.sort_order) || 0,
            })),
            settings: {
                queueEnabled: settings.queueEnabled,
                loyaltyEnabled: settings.loyaltyEnabled,
                loyaltyWindowHours: settings.loyaltyWindowHours,
            },
            rules: rules.map((row) => ({
                fromPlanId: row.from_plan_id,
                toPlanId: row.to_plan_id,
                percent: Number(row.percent) || 0,
            })),
        },
    });
}

async function handleSaveSettings(req, res) {
    await policy.ensureSubscriptionCatalog();
    const queueEnabled = flag(req.body?.queueEnabled);
    const loyaltyEnabled = flag(req.body?.loyaltyEnabled);
    const loyaltyWindowHours = cleanHours(req.body?.loyaltyWindowHours);
    if (loyaltyWindowHours == null) {
        return res.status(400).json({ success: false, message: 'مدت پنجره تخفیف باید بین ۱ تا ۲۱۶۰ ساعت باشد.' });
    }
    await pool.query(
        `INSERT INTO subscription_settings (id, queue_enabled, loyalty_enabled, loyalty_window_hours)
         VALUES (1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            queue_enabled = VALUES(queue_enabled),
            loyalty_enabled = VALUES(loyalty_enabled),
            loyalty_window_hours = VALUES(loyalty_window_hours)`,
        [queueEnabled ? 1 : 0, loyaltyEnabled ? 1 : 0, loyaltyWindowHours]
    );
    return res.json({ success: true, message: 'تنظیمات اشتراک ذخیره شد.' });
}

async function handleSavePlan(req, res) {
    await policy.ensureSubscriptionCatalog();
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'شناسه پلن نامعتبر است.' });
    const [existing] = await pool.query(`SELECT id FROM subscription_plans WHERE id = ? LIMIT 1`, [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'پلن پیدا نشد.' });

    const name = cleanName(req.body?.name);
    const price = cleanPrice(req.body?.price);
    const unlimited = flag(req.body?.unlimited) || req.body?.days === null || req.body?.days === '';
    const days = cleanDays(unlimited ? null : req.body?.days, unlimited);
    if (!name) return res.status(400).json({ success: false, message: 'نام اشتراک را وارد کنید.' });
    if (price == null) return res.status(400).json({ success: false, message: 'قیمت نامعتبر است.' });
    if (days === undefined) return res.status(400).json({ success: false, message: 'مدت اشتراک باید بین ۱ تا ۳۶۵۰ روز باشد، یا نامحدود.' });

    await pool.query(
        `UPDATE subscription_plans
         SET name = ?, price = ?, days = ?, popular = ?, is_active = ?, purchasable = ?, sort_order = ?
         WHERE id = ?`,
        [
            name,
            price,
            days,
            flag(req.body?.popular) ? 1 : 0,
            flag(req.body?.isActive) ? 1 : 0,
            flag(req.body?.purchasable) ? 1 : 0,
            Number.isInteger(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0,
            id,
        ]
    );
    return res.json({ success: true, message: 'اشتراک ذخیره شد.' });
}

async function handleSaveLoyalty(req, res) {
    await policy.ensureSubscriptionCatalog();
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : null;
    if (!rules) return res.status(400).json({ success: false, message: 'جدول تخفیف ارسال نشده است.' });
    const [plans] = await pool.query(`SELECT id FROM subscription_plans`);
    const ids = new Set(plans.map((row) => String(row.id)));
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const rule of rules) {
            const fromPlanId = String(rule.fromPlanId || '');
            const toPlanId = String(rule.toPlanId || '');
            const percent = cleanPercent(rule.percent);
            if (!ids.has(fromPlanId) || !ids.has(toPlanId) || percent == null) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'یکی از درصدهای تخفیف نامعتبر است.' });
            }
            await connection.query(
                `INSERT INTO subscription_loyalty_rules (from_plan_id, to_plan_id, percent)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE percent = VALUES(percent)`,
                [fromPlanId, toPlanId, percent]
            );
        }
        await connection.commit();
    } catch (err) {
        try { await connection.rollback(); } catch (_) { /* ignore */ }
        throw err;
    } finally {
        connection.release();
    }
    return res.json({ success: true, message: 'جدول تخفیف پس از انقضا ذخیره شد.' });
}

module.exports = {
    handleGetCatalog,
    handleSaveSettings,
    handleSavePlan,
    handleSaveLoyalty,
};
