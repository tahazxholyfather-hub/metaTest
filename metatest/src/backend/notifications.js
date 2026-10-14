'use strict';

const { COIN_PACKAGES } = require('./subscription/limits');

function getPool() {
    return require('./db');
}

let schemaReady = null;

async function ensureSchema(db) {
    const query = (sql) => (db || getPool()).query(sql);
    await query(`
        CREATE TABLE IF NOT EXISTS tam24_announcements (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            audience ENUM('all','subscribers','plan') NOT NULL DEFAULT 'all',
            plan_id VARCHAR(40) NULL,
            created_by INT NULL,
            recipient_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_announcements_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    const alters = [
        `ALTER TABLE tam24_in_app_messages ADD COLUMN kind VARCHAR(40) NULL DEFAULT NULL`,
        `ALTER TABLE tam24_in_app_messages ADD COLUMN dedupe_key VARCHAR(140) NULL DEFAULT NULL`,
        `ALTER TABLE tam24_in_app_messages ADD COLUMN announcement_id BIGINT UNSIGNED NULL DEFAULT NULL`,
        `ALTER TABLE tam24_in_app_messages ADD UNIQUE KEY uq_message_dedupe (dedupe_key)`,
    ];
    for (const sql of alters) {
        try { await query(sql); } catch (err) {
            if (!err || !['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code)) {
                console.error('[notifications] alter', err && err.message);
            }
        }
    }
}

function ready() {
    if (!schemaReady) {
        schemaReady = ensureSchema().catch((err) => {
            schemaReady = null;
            console.error('[notifications] schema', err.message);
            throw err;
        });
    }
    return schemaReady;
}

function audienceSql(audience, planId) {
    if (audience === 'subscribers') {
        return {
            sql: `current_plan IS NOT NULL AND current_plan NOT IN ('', 'free', '0') AND (plan_expires_at IS NULL OR plan_expires_at > NOW())`,
            params: [],
        };
    }
    if (audience === 'plan') {
        return {
            sql: `current_plan = ? AND (plan_expires_at IS NULL OR plan_expires_at > NOW())`,
            params: [String(planId || '')],
        };
    }
    return { sql: '1=1', params: [] };
}

async function notifyUser(userId, { title, body, kind = 'system', dedupeKey = null, announcementId = null }) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return { sent: false };
    const cleanTitle = String(title || '').trim().slice(0, 255);
    const cleanBody = String(body || '').trim().slice(0, 4000);
    if (!cleanTitle || !cleanBody) return { sent: false };
    try {
        await ready();
        await getPool().query(
            `INSERT INTO tam24_in_app_messages (user_id, title, body, kind, dedupe_key, announcement_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, cleanTitle, cleanBody, kind, dedupeKey, announcementId]
        );
        return { sent: true };
    } catch (err) {
        if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) return { sent: false, duplicate: true };
        console.error('[notifications] notify', err.message);
        return { sent: false };
    }
}

async function broadcast({ title, body, audience = 'all', planId = null, adminId = null }) {
    const cleanTitle = String(title || '').trim().slice(0, 255);
    const cleanBody = String(body || '').trim().slice(0, 4000);
    const who = ['all', 'subscribers', 'plan'].includes(audience) ? audience : 'all';
    if (!cleanTitle || !cleanBody) {
        return { ok: false, message: 'عنوان و متن اعلان لازم است.' };
    }
    if (who === 'plan' && !String(planId || '').trim()) {
        return { ok: false, message: 'پلن مخاطب را انتخاب کن.' };
    }
    await ready();
    const pool = getPool();
    const filter = audienceSql(who, planId);
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM tam24_users WHERE ${filter.sql}`,
        filter.params
    );
    const total = Number(countRows[0]?.total) || 0;
    const [created] = await pool.query(
        `INSERT INTO tam24_announcements (title, body, audience, plan_id, created_by, recipient_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cleanTitle, cleanBody, who, who === 'plan' ? String(planId) : null, adminId || null, total]
    );
    const announcementId = created.insertId;
    const batch = 400;
    let offset = 0;
    while (offset < total) {
        const [users] = await pool.query(
            `SELECT id FROM tam24_users WHERE ${filter.sql} ORDER BY id ASC LIMIT ${batch} OFFSET ${offset}`,
            filter.params
        );
        if (!users.length) break;
        const placeholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const params = [];
        for (const user of users) {
            params.push(user.id, cleanTitle, cleanBody, 'announcement', `announcement:${announcementId}:user:${user.id}`, announcementId);
        }
        await pool.query(
            `INSERT IGNORE INTO tam24_in_app_messages (user_id, title, body, kind, dedupe_key, announcement_id)
             VALUES ${placeholders}`,
            params
        );
        offset += users.length;
    }
    return { ok: true, id: announcementId, recipientCount: total };
}

async function listAnnouncements(limit = 30) {
    await ready();
    const [rows] = await getPool().query(
        `SELECT a.id, a.title, a.body, a.audience, a.plan_id, a.recipient_count, a.created_at,
                p.name AS plan_name, adm.username AS admin_username
         FROM tam24_announcements a
         LEFT JOIN subscription_plans p ON p.id = a.plan_id
         LEFT JOIN tam24_admins adm ON adm.id = a.created_by
         ORDER BY a.id DESC
         LIMIT ?`,
        [Math.min(100, Math.max(1, Number(limit) || 30))]
    );
    return rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        body: row.body,
        audience: row.audience,
        planId: row.plan_id,
        planName: row.plan_name || null,
        recipientCount: Number(row.recipient_count) || 0,
        createdAt: row.created_at,
        adminUsername: row.admin_username || '',
    }));
}

async function markRead(userId, { ids = null, all = false } = {}) {
    await ready();
    if (all) {
        await getPool().query(
            `UPDATE tam24_in_app_messages SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        return;
    }
    const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 100);
    if (!clean.length) return;
    const marks = clean.map(() => '?').join(', ');
    await getPool().query(
        `UPDATE tam24_in_app_messages SET is_read = 1 WHERE user_id = ? AND id IN (${marks})`,
        [userId, ...clean]
    );
}

async function maybePlanNotices(user) {
    if (!user || !user.id) return;
    const plan = String(user.current_plan || '').trim();
    if (!plan || plan === 'free' || plan === '0') return;
    const exp = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
    if (!exp || Number.isNaN(exp.getTime())) return;
    const msLeft = exp.getTime() - Date.now();
    const day = exp.toISOString().slice(0, 10);
    if (msLeft <= 0) {
        await notifyUser(user.id, {
            title: 'اشتراک تمام شد',
            body: 'مهلت اشتراک فعلی‌ات تمام شده. برای ادامه‌ی مِت و آزمون‌ها می‌توانی دوباره اشتراک بگیری.',
            kind: 'plan',
            dedupeKey: `plan-expired:${user.id}:${day}`,
        });
        return;
    }
    const days = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    if (days <= 3) {
        await notifyUser(user.id, {
            title: 'اشتراک رو به پایان است',
            body: `حدود ${days.toLocaleString('fa-IR')} روز تا پایان اشتراک مانده است.`,
            kind: 'plan',
            dedupeKey: `plan-expiring:${user.id}:${day}`,
        });
    }
}

function packageSeed() {
    return COIN_PACKAGES.map((pack, index) => ({
        id: pack.id,
        coins: pack.coins,
        priceToman: pack.priceToman,
        title: pack.title,
        subtitle: pack.subtitle || '',
        popular: pack.popular ? 1 : 0,
        active: 1,
        sortOrder: index + 1,
    }));
}

module.exports = {
    ensureSchema,
    audienceSql,
    notifyUser,
    broadcast,
    listAnnouncements,
    markRead,
    maybePlanNotices,
    packageSeed,
};
