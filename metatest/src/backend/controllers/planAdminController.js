'use strict';

const pool = require('../db');
const { readPlan } = require('../subscription/planInput');

function iconPreset(name) {
    if (String(name).includes('برنز')) {
        return ['#cd7f32', '#a0522d', 'shimmer-bronze', 'shadow-[0_0_25px_rgba(205,127,50,0.15)]', 'border-[#cd7f32]/60'];
    }
    if (String(name).includes('طلا')) {
        return ['#fbbf24', '#b45309', 'shimmer-golden', 'shadow-[0_0_25px_rgba(251,191,36,0.15)]', 'border-amber-500/60'];
    }
    if (String(name).includes('الماس') || String(name).includes('دیاموند')) {
        return ['#38bdf8', '#1d4ed8', 'shimmer-diamond', 'shadow-[0_0_25px_rgba(56,189,248,0.15)]', 'border-sky-500/60'];
    }
    return ['#94a3b8', '#475569', 'shimmer-silver', 'shadow-[0_0_25px_rgba(148,163,184,0.15)]', 'border-slate-400/60'];
}

function mapPlan(row) {
    return {
        id: row.id,
        name: row.name,
        days: Number(row.days),
        price: Number(row.price),
        planDiscountPercent: Number(row.plan_discount_percent || 0),
        popular: Number(row.popular) === 1,
        isActive: Number(row.is_active) === 1,
        sortOrder: Number(row.sort_order) || 0,
    };
}

async function handleList(_req, res) {
    const [rows] = await pool.query(
        `SELECT id, name, days, price, plan_discount_percent, popular, is_active, sort_order
         FROM subscription_plans
         ORDER BY sort_order ASC, price ASC, id ASC`
    );
    return res.json({ success: true, data: rows.map(mapPlan) });
}

async function handleSave(req, res) {
    const parsed = readPlan(req.body || {});
    if (parsed.error) return res.json({ success: false, message: parsed.error });
    const plan = parsed.value;
    const [existing] = await pool.query(`SELECT id FROM subscription_plans WHERE id = ? LIMIT 1`, [plan.id]);
    if (existing.length) {
        await pool.query(
            `UPDATE subscription_plans
             SET name = ?, days = ?, price = ?, plan_discount_percent = ?, popular = ?, is_active = ?, sort_order = ?
             WHERE id = ?`,
            [plan.name, plan.days, plan.price, plan.planDiscountPercent, plan.popular, plan.isActive, plan.sortOrder, plan.id]
        );
    } else {
        const [primary, secondary, shimmer, shadow, border] = iconPreset(plan.name);
        await pool.query(
            `INSERT INTO subscription_plans
                (id, name, days, price, plan_discount_percent, icon_primary, icon_secondary, shimmer_class, active_shadow, active_border, popular, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [plan.id, plan.name, plan.days, plan.price, plan.planDiscountPercent, primary, secondary, shimmer, shadow, border, plan.popular, plan.isActive, plan.sortOrder]
        );
    }
    return res.json({ success: true, message: 'پلن ذخیره شد. صفحه اصلی همان فهرست را نشان می‌دهد.' });
}

module.exports = {
    handleList,
    handleSave,
};
