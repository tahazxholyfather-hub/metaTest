'use strict';

const pool = require('../db');
const { broadcast, listAnnouncements } = require('../notifications');

const handleList = async (_req, res) => {
    const [plans] = await pool.query(
        `SELECT id, name FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
    );
    return res.json({
        success: true,
        announcements: await listAnnouncements(),
        plans: plans.map((plan) => ({ id: plan.id, name: plan.name })),
    });
};

const handleSend = async (req, res) => {
    const result = await broadcast({
        title: req.body.title,
        body: req.body.body,
        audience: req.body.audience,
        planId: req.body.planId || req.body.plan_id,
        adminId: req.admin?.id,
    });
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    return res.json({
        success: true,
        message: result.recipientCount
            ? `اعلان برای ${result.recipientCount.toLocaleString('fa-IR')} کاربر فرستاده شد.`
            : 'مخاطبی با این فیلتر پیدا نشد.',
        id: result.id,
        recipientCount: result.recipientCount,
        announcements: await listAnnouncements(),
    });
};

module.exports = { handleList, handleSend };
