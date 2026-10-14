'use strict';

const pool = require('../db');
const { listCoinPackages, saveCoinPackages } = require('../coinCatalog');
const { snapshotRuntimeSettings, applyRuntimeOverlay, dailyCoinsForPlan } = require('../ai-teacher/config');

const PLAN_KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;

async function loadMergedSettings() {
    let existing;
    try {
        const [[row]] = await pool.query(`SELECT settings_json FROM tam24_ai_admin_settings WHERE id = 1`);
        existing = row;
    } catch (err) {
        if (!err || err.code !== 'ER_NO_SUCH_TABLE') console.error('coin settings:', err.message);
        return {};
    }
    let prev = {};
    const stored = existing?.settings_json;
    if (stored && typeof stored === 'object') prev = stored;
    else {
        try { prev = stored ? JSON.parse(stored) : {}; } catch { prev = {}; }
    }
    if (prev && typeof prev === 'object') applyRuntimeOverlay(prev);
    return prev && typeof prev === 'object' ? prev : {};
}

async function saveDailyCoins(dailyCoins, adminId) {
    const clean = {};
    for (const [rawKey, value] of Object.entries(dailyCoins || {})) {
        const key = String(rawKey || '').trim().toLowerCase();
        if (!PLAN_KEY.test(key)) continue;
        const amount = Math.floor(Number(value));
        if (!Number.isInteger(amount) || amount < 0 || amount > 1000000) {
            return { ok: false, message: `مقدار سکه روزانه برای ${key} نامعتبر است.` };
        }
        clean[key] = amount;
    }
    if (!Object.keys(clean).length) return { ok: false, message: 'مقداری برای ذخیره نیست.' };
    const prev = await loadMergedSettings();
    const merged = { ...prev, dailyCoins: { ...(prev.dailyCoins || {}), ...clean } };
    await pool.query(
        `INSERT INTO tam24_ai_admin_settings (id, settings_json, updated_by)
         VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_by = VALUES(updated_by)`,
        [JSON.stringify(merged), adminId || null]
    );
    applyRuntimeOverlay(merged);
    return { ok: true, dailyCoins: snapshotRuntimeSettings().dailyCoins };
}

const handleGetCoins = async (_req, res) => {
    let plans = [];
    try {
        const [rows] = await pool.query(
            `SELECT id, name, is_active FROM subscription_plans ORDER BY sort_order ASC, id ASC`
        );
        plans = rows;
    } catch (err) {
        console.error('coin plans:', err.message);
    }
    const prev = await loadMergedSettings();
    const snap = snapshotRuntimeSettings();
    const daily = { free: dailyCoinsForPlan('free') };
    for (const plan of plans) daily[plan.id] = dailyCoinsForPlan(plan.id);
    Object.assign(daily, snap.dailyCoins || {}, prev.dailyCoins || {});
    return res.json({
        success: true,
        packages: await listCoinPackages(pool),
        dailyCoins: daily,
        plans: plans.map((plan) => ({ id: plan.id, name: plan.name, active: Number(plan.is_active) === 1 })),
    });
};

const handleSavePackages = async (req, res) => {
    const result = await saveCoinPackages(pool, req.body.packages || req.body);
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    return res.json({ success: true, packages: result.packages, message: 'قیمت بسته‌های سکه ذخیره شد.' });
};

const handleSaveDaily = async (req, res) => {
    const result = await saveDailyCoins(req.body.dailyCoins || req.body, req.admin?.id);
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    return res.json({ success: true, dailyCoins: result.dailyCoins, message: 'سکه روزانه ذخیره شد.' });
};

module.exports = { handleGetCoins, handleSavePackages, handleSaveDaily };
