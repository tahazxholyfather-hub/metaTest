'use strict';

const pool = require('../db');
const { validateContact } = require('../contact/validate');

const STATUSES = new Set(['new', 'read', 'archived']);
const hits = new Map();
let schemaReady = null;

function clientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim().slice(0, 64);
    return String(req.socket?.remoteAddress || '').slice(0, 64) || null;
}

function rateLimited(ip) {
    const key = ip || 'unknown';
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const recent = (hits.get(key) || []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= 8) {
        hits.set(key, recent);
        return true;
    }
    recent.push(now);
    hits.set(key, recent);
    return false;
}

function ensureContactSchema() {
    if (!schemaReady) {
        schemaReady = pool.query(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id INT NOT NULL AUTO_INCREMENT,
                name VARCHAR(80) NOT NULL,
                email VARCHAR(180) NULL,
                phone VARCHAR(24) NULL,
                subject VARCHAR(140) NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'new',
                ip VARCHAR(64) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_contact_status (status, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `).catch((err) => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

function present(row) {
    return {
        id: Number(row.id),
        name: row.name,
        email: row.email || '',
        phone: row.phone || '',
        subject: row.subject,
        message: row.message,
        status: STATUSES.has(row.status) ? row.status : 'new',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    };
}

async function handlePublicSubmit(req, res) {
    const trap = String(req.body?.website || '').trim();
    if (trap) return res.json({ success: true, message: 'پیام شما ثبت شد.' });
    if (rateLimited(clientIp(req))) {
        return res.status(429).json({ success: false, message: 'پیام‌های زیادی فرستاده شده. چند دقیقه بعد دوباره تلاش کنید.' });
    }
    const parsed = validateContact(req.body || {});
    if (!parsed.ok) {
        return res.status(400).json({ success: false, message: 'فرم را کامل کنید.', errors: parsed.errors });
    }
    await ensureContactSchema();
    const value = parsed.value;
    await pool.query(
        `INSERT INTO contact_messages (name, email, phone, subject, message, status, ip)
         VALUES (?, ?, ?, ?, ?, 'new', ?)`,
        [value.name, value.email, value.phone, value.subject, value.message, clientIp(req)]
    );
    return res.json({ success: true, message: 'پیام شما ثبت شد. در پنل پشتیبانی دیده می‌شود.' });
}

async function handleAdminList(req, res) {
    await ensureContactSchema();
    const status = String(req.query.status || 'all');
    const where = STATUSES.has(status) ? 'WHERE status = ?' : '';
    const params = STATUSES.has(status) ? [status] : [];
    const [rows] = await pool.query(
        `SELECT id, name, email, phone, subject, message, status, created_at
         FROM contact_messages ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT 200`,
        params
    );
    const [counts] = await pool.query(
        `SELECT status, COUNT(*) AS n FROM contact_messages GROUP BY status`
    );
    const summary = { new: 0, read: 0, archived: 0 };
    for (const row of counts) {
        if (Object.prototype.hasOwnProperty.call(summary, row.status)) summary[row.status] = Number(row.n);
    }
    return res.json({ success: true, messages: rows.map(present), summary });
}

async function handleAdminUpdate(req, res) {
    await ensureContactSchema();
    const id = Number(req.params.id);
    const status = String(req.body?.status || '');
    if (!Number.isInteger(id) || id < 1 || !STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'وضعیت پیام معتبر نیست.' });
    }
    const [result] = await pool.query(`UPDATE contact_messages SET status = ? WHERE id = ?`, [status, id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'پیام پیدا نشد.' });
    return res.json({ success: true });
}

async function handleAdminDelete(req, res) {
    await ensureContactSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'پیام پیدا نشد.' });
    await pool.query(`DELETE FROM contact_messages WHERE id = ?`, [id]);
    return res.json({ success: true });
}

module.exports = {
    ensureContactSchema,
    handlePublicSubmit,
    handleAdminList,
    handleAdminUpdate,
    handleAdminDelete,
};
