'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { profile } = require('../runtimeMode');

let webpush = null;
try {
    webpush = require('web-push');
} catch (err) {
    console.error('[push] web-push is not installed:', err.message);
}

const VAPID_FILE = path.join(__dirname, '../data/vapid.json');
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@metatest.app';

const RULES = [
    {
        key: 'practice_idle_2',
        title: 'دو روزه تمرینی نداری',
        body: 'برگرد به متاتست و چند سؤال حل کن. عادت تمرین با همین چند دقیقه برمی‌گردد.',
        link: '/practice',
    },
    {
        key: 'practice_idle_3',
        title: 'سه روز از آخرین تمرینت گذشت',
        body: 'سوال‌ها منتظر تو هستند. یک جلسه کوتاه امروز کافی است.',
        link: '/practice',
    },
    {
        key: 'level_up',
        title: 'سطح جدید',
        body: 'آفرین. به سطح {level} رسیدی.',
        link: '/profile',
    },
    {
        key: 'achievement_quiz_10',
        title: 'ده روز تمرین',
        body: 'ده روز تمرین ثبت شد. این عادت را نگه دار.',
        link: '/History',
    },
    {
        key: 'review_waiting',
        title: 'جعبه مرور پر است',
        body: '{count} سؤال در جعبه مرور منتظر توست.',
        link: '/reviewbox',
    },
    {
        key: 'streak_risk',
        title: 'زنجیره امروز در خطر است',
        body: 'دیروز تمرین کردی. اگر امروز هم یک سؤال حل کنی زنجیره نمی‌شکند.',
        link: '/practice',
    },
    {
        key: 'plan_expiring',
        title: 'اشتراک رو به پایان است',
        body: 'کمتر از سه روز تا پایان اشتراک مانده. برای قطع نشدن دسترسی تمدید کن.',
        link: '/profile',
    },
];

let schemaReady = null;
let vapidState = null;
let schedulerStarted = false;

function ensureSchema() {
    if (!schemaReady) {
        schemaReady = createSchema().catch((err) => {
            schemaReady = null;
            console.error('[push] schema', err.message);
            throw err;
        });
    }
    return schemaReady;
}

async function createSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            endpoint TEXT NOT NULL,
            endpoint_hash CHAR(64) NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            user_agent VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_push_endpoint (endpoint_hash),
            KEY idx_push_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_rules (
            rule_key VARCHAR(40) NOT NULL,
            enabled TINYINT NOT NULL DEFAULT 0,
            title VARCHAR(160) NOT NULL,
            body VARCHAR(500) NOT NULL,
            icon VARCHAR(500) NULL,
            image VARCHAR(500) NULL,
            link VARCHAR(500) NULL,
            config_json TEXT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (rule_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_sends (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NULL,
            rule_key VARCHAR(40) NULL,
            title VARCHAR(160) NOT NULL,
            body VARCHAR(500) NOT NULL,
            link VARCHAR(500) NULL,
            status VARCHAR(24) NOT NULL,
            dedupe_key VARCHAR(140) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_push_dedupe (dedupe_key),
            KEY idx_push_sends_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    for (const rule of RULES) {
        await pool.query(
            `INSERT IGNORE INTO notification_rules (rule_key, enabled, title, body, icon, image, link)
             VALUES (?, 0, ?, ?, NULL, NULL, ?)`,
            [rule.key, rule.title, rule.body, rule.link]
        );
    }
}

function loadVapid() {
    if (vapidState) return vapidState;
    const fromEnv = String(process.env.VAPID_PUBLIC_KEY || '').trim();
    const privateEnv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
    if (fromEnv && privateEnv) {
        vapidState = { publicKey: fromEnv, privateKey: privateEnv, source: 'env' };
        return vapidState;
    }
    try {
        if (fs.existsSync(VAPID_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
            if (parsed.publicKey && parsed.privateKey) {
                vapidState = { publicKey: parsed.publicKey, privateKey: parsed.privateKey, source: 'file' };
                return vapidState;
            }
        }
    } catch (err) {
        console.error('[push] could not read vapid file');
    }
    if (!webpush) return null;
    const generated = webpush.generateVAPIDKeys();
    try {
        fs.mkdirSync(path.dirname(VAPID_FILE), { recursive: true });
        fs.writeFileSync(VAPID_FILE, JSON.stringify({ publicKey: generated.publicKey, privateKey: generated.privateKey }));
        console.log('[push] vapid keys generated');
    } catch (err) {
        console.error('[push] could not store vapid keys:', err.message);
        return null;
    }
    vapidState = { publicKey: generated.publicKey, privateKey: generated.privateKey, source: 'generated' };
    return vapidState;
}

function vapid() {
    const keys = loadVapid();
    if (!keys || !webpush) return null;
    if (!keys.ready) {
        webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
        keys.ready = true;
    }
    return keys;
}

function clip(value, max) {
    return String(value || '').trim().slice(0, max);
}

function fill(template, vars) {
    return Object.entries(vars || {}).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        String(template || '')
    );
}

function absoluteLink(link) {
    const raw = clip(link, 500) || '/';
    if (/^https?:\/\//i.test(raw)) return raw;
    const pathName = raw.startsWith('/') ? raw : `/${raw}`;
    if (!profile.localhost) {
        if (pathName === '/app' || pathName.startsWith('/app/')) return `${profile.frontendOrigin}${pathName}`;
        return `${profile.frontendOrigin}/app${pathName}`;
    }
    return `${profile.frontendOrigin}${pathName}`;
}

function defaultIcon() {
    const base = profile.appBase === '/' ? '/' : profile.appBase;
    return `${profile.frontendOrigin}${base}favicon-192x192.png`;
}

function notePayload(note) {
    const icon = clip(note.icon, 500) || defaultIcon();
    const image = clip(note.image, 500);
    return {
        title: clip(note.title, 160) || 'متاتست',
        body: clip(note.body, 500),
        icon,
        image: image || undefined,
        url: absoluteLink(note.link),
    };
}

async function pushOne(row, payload) {
    const keys = vapid();
    if (!keys) return false;
    try {
        await webpush.sendNotification({
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
        }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        return true;
    } catch (err) {
        const status = err && err.statusCode;
        if (status === 404 || status === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', [row.endpoint_hash]);
        } else {
            console.error('[push] send failed', status || (err && err.message));
        }
        return false;
    }
}

async function subscriptionsFor(userId) {
    const [rows] = await pool.query(
        `SELECT endpoint, endpoint_hash, p256dh, auth FROM push_subscriptions WHERE user_id = ?`,
        [userId]
    );
    return rows;
}

async function claim(userId, note, dedupeKey) {
    if (!dedupeKey) return true;
    try {
        await pool.query(
            `INSERT INTO push_sends (user_id, rule_key, title, body, link, status, dedupe_key)
             VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
            [userId || null, note.ruleKey || null, clip(note.title, 160), clip(note.body, 500), clip(note.link, 500) || null, dedupeKey]
        );
        return true;
    } catch (err) {
        if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) return false;
        throw err;
    }
}

async function finishClaim(dedupeKey, delivered) {
    if (!dedupeKey) return;
    await pool.query('UPDATE push_sends SET status = ? WHERE dedupe_key = ?', [delivered ? 'sent' : 'failed', dedupeKey]);
}

async function sendToUser(userId, note, dedupeKey) {
    await ensureSchema();
    const claimed = await claim(userId, note, dedupeKey);
    if (!claimed) return { skipped: true, delivered: 0 };
    const payload = notePayload(note);
    const subs = await subscriptionsFor(userId);
    let delivered = 0;
    for (const sub of subs) {
        if (await pushOne(sub, payload)) delivered += 1;
    }
    await finishClaim(dedupeKey, delivered > 0);
    if (!dedupeKey) {
        await pool.query(
            `INSERT INTO push_sends (user_id, rule_key, title, body, link, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId || null, note.ruleKey || null, payload.title, payload.body, note.link || null, delivered ? 'sent' : 'failed']
        );
    }
    return { delivered, skipped: false };
}

async function getRule(key) {
    await ensureSchema();
    const [rows] = await pool.query('SELECT * FROM notification_rules WHERE rule_key = ? LIMIT 1', [key]);
    const row = rows[0];
    if (!row) return null;
    return {
        key: row.rule_key,
        enabled: Number(row.enabled) === 1,
        title: row.title,
        body: row.body,
        icon: row.icon || '',
        image: row.image || '',
        link: row.link || '',
    };
}

async function notifyLevelUp(userId, level) {
    try {
        const rule = await getRule('level_up');
        if (!rule || !rule.enabled) return;
        const vars = { level: Number(level) || 1 };
        await sendToUser(userId, {
            ...rule,
            ruleKey: rule.key,
            title: fill(rule.title, vars),
            body: fill(rule.body, vars),
        }, `level_up:${userId}:${vars.level}`);
    } catch (err) {
        console.error('[push] level', err.message);
    }
}

async function notifyPracticeFinished(userId) {
    try {
        const rule = await getRule('achievement_quiz_10');
        if (!rule || !rule.enabled) return;
        const [rows] = await pool.query(
            `SELECT COUNT(DISTINCT activity_date) AS days FROM tam24_user_activity WHERE user_id = ?`,
            [userId]
        );
        const days = Number(rows[0]?.days) || 0;
        if (days < 10) return;
        await sendToUser(userId, { ...rule, ruleKey: rule.key }, `achievement_quiz_10:${userId}`);
    } catch (err) {
        console.error('[push] achievement', err.message);
    }
}

async function runRule(rule) {
    if (rule.key === 'practice_idle_2' || rule.key === 'practice_idle_3') {
        const days = rule.key === 'practice_idle_3' ? 3 : 2;
        const [idle3] = rule.key === 'practice_idle_2'
            ? await pool.query(`SELECT enabled FROM notification_rules WHERE rule_key = 'practice_idle_3' LIMIT 1`)
            : [[]];
        const both = rule.key === 'practice_idle_2' && Number(idle3[0]?.enabled) === 1;
        const ceiling = both ? 'AND MAX(a.activity_date) > DATE_SUB(CURDATE(), INTERVAL 3 DAY)' : '';
        const [users] = await pool.query(
            `SELECT a.user_id
             FROM tam24_user_activity a
             INNER JOIN push_subscriptions s ON s.user_id = a.user_id
             GROUP BY a.user_id
             HAVING MAX(a.activity_date) <= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             ${ceiling}`,
            [days]
        );
        for (const user of users) {
            await sendToUser(user.user_id, { ...rule, ruleKey: rule.key }, `${rule.key}:${user.user_id}:${todayKey()}`);
        }
        return;
    }
    if (rule.key === 'streak_risk') {
        const [users] = await pool.query(
            `SELECT y.user_id
             FROM tam24_user_activity y
             INNER JOIN push_subscriptions s ON s.user_id = y.user_id
             WHERE y.activity_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
               AND NOT EXISTS (
                 SELECT 1 FROM tam24_user_activity t
                 WHERE t.user_id = y.user_id AND t.activity_date = CURDATE()
               )
             GROUP BY y.user_id`
        );
        for (const user of users) {
            await sendToUser(user.user_id, { ...rule, ruleKey: rule.key }, `streak_risk:${user.user_id}:${todayKey()}`);
        }
        return;
    }
    if (rule.key === 'review_waiting') {
        const [users] = await pool.query(
            `SELECT r.user_id, COUNT(*) AS waiting
             FROM review_later_tam24 r
             INNER JOIN push_subscriptions s ON s.user_id = r.user_id
             GROUP BY r.user_id
             HAVING waiting > 0`
        );
        for (const user of users) {
            const vars = { count: Number(user.waiting) || 0 };
            await sendToUser(user.user_id, {
                ...rule,
                ruleKey: rule.key,
                title: fill(rule.title, vars),
                body: fill(rule.body, vars),
            }, `review_waiting:${user.user_id}:${todayKey()}`);
        }
        return;
    }
    if (rule.key === 'achievement_quiz_10') {
        const [users] = await pool.query(
            `SELECT a.user_id
             FROM tam24_user_activity a
             INNER JOIN push_subscriptions s ON s.user_id = a.user_id
             GROUP BY a.user_id
             HAVING COUNT(DISTINCT a.activity_date) >= 10`
        );
        for (const user of users) {
            await sendToUser(user.user_id, { ...rule, ruleKey: rule.key }, `achievement_quiz_10:${user.user_id}`);
        }
        return;
    }
    if (rule.key === 'plan_expiring') {
        const [users] = await pool.query(
            `SELECT u.id AS user_id, DATE(u.plan_expires_at) AS exp_day
             FROM tam24_users u
             INNER JOIN push_subscriptions s ON s.user_id = u.id
             WHERE u.plan_expires_at IS NOT NULL
               AND u.plan_expires_at > NOW()
               AND u.plan_expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)
               AND u.current_plan IS NOT NULL
               AND u.current_plan NOT IN ('', 'free', '0')
             GROUP BY u.id, DATE(u.plan_expires_at)`
        );
        for (const user of users) {
            const day = user.exp_day instanceof Date ? user.exp_day.toISOString().slice(0, 10) : String(user.exp_day).slice(0, 10);
            await sendToUser(user.user_id, { ...rule, ruleKey: rule.key }, `plan_expiring:${user.user_id}:${day}`);
        }
    }
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

async function runSmart() {
    if (!vapid()) return;
    await ensureSchema();
    const [rows] = await pool.query('SELECT * FROM notification_rules WHERE enabled = 1');
    for (const row of rows) {
        if (row.rule_key === 'level_up') continue;
        try {
            await runRule({
                key: row.rule_key,
                title: row.title,
                body: row.body,
                icon: row.icon || '',
                image: row.image || '',
                link: row.link || '',
            });
        } catch (err) {
            console.error('[push] rule', row.rule_key, err.message);
        }
    }
}

function startPushScheduler() {
    if (schedulerStarted) return;
    schedulerStarted = true;
    setTimeout(() => {
        runSmart().catch((err) => console.error('[push] scheduler', err.message));
    }, 45000);
    setInterval(() => {
        runSmart().catch((err) => console.error('[push] scheduler', err.message));
    }, 30 * 60 * 1000);
}

async function listRules() {
    await ensureSchema();
    const [rows] = await pool.query('SELECT * FROM notification_rules ORDER BY rule_key ASC');
    return rows.map((row) => ({
        key: row.rule_key,
        enabled: Number(row.enabled) === 1,
        title: row.title,
        body: row.body,
        icon: row.icon || '',
        image: row.image || '',
        link: row.link || '',
    }));
}

async function adminOverview() {
    await ensureSchema();
    const keys = vapid();
    const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM push_subscriptions');
    const [[userRow]] = await pool.query('SELECT COUNT(DISTINCT user_id) AS total FROM push_subscriptions');
    const [recent] = await pool.query(
        `SELECT id, user_id, rule_key, title, body, link, status, created_at
         FROM push_sends ORDER BY id DESC LIMIT 20`
    );
    return {
        success: true,
        webPushReady: Boolean(keys),
        publicKey: keys ? keys.publicKey : '',
        subscriptionCount: Number(countRow?.total) || 0,
        subscriberCount: Number(userRow?.total) || 0,
        rules: await listRules(),
        recent: recent.map((row) => ({
            id: Number(row.id),
            userId: row.user_id,
            ruleKey: row.rule_key,
            title: row.title,
            body: row.body,
            link: row.link,
            status: row.status,
            createdAt: row.created_at,
        })),
    };
}

async function saveRule(key, body) {
    await ensureSchema();
    const known = RULES.some((rule) => rule.key === key);
    if (!known) return { success: false, message: 'این قانون شناخته نشده است.' };
    const enabled = body.enabled ? 1 : 0;
    const title = clip(body.title, 160);
    const text = clip(body.body, 500);
    if (!title || !text) return { success: false, message: 'عنوان و متن لازم است.' };
    await pool.query(
        `UPDATE notification_rules
         SET enabled = ?, title = ?, body = ?, icon = ?, image = ?, link = ?
         WHERE rule_key = ?`,
        [enabled, title, text, clip(body.icon, 500) || null, clip(body.image, 500) || null, clip(body.link, 500) || null, key]
    );
    return { success: true, rules: await listRules() };
}

async function findUser(query) {
    const needle = clip(query, 80);
    if (!needle) return null;
    const [rows] = await pool.query(
        `SELECT id, phone, username, first_name, last_name
         FROM tam24_users
         WHERE phone = ? OR username = ?
         LIMIT 1`,
        [needle, needle]
    );
    return rows[0] || null;
}

async function sendManual(userId, note) {
    return sendToUser(userId, { ...note, ruleKey: note.ruleKey || 'manual' }, null);
}

async function handleTest(body) {
    if (!vapid()) return { success: false, message: 'کتابخانه پوش روی سرور آماده نیست.' };
    const user = await findUser(body.query || body.phone || body.username);
    if (!user) return { success: false, message: 'کاربری با این شماره یا نام کاربری پیدا نشد.' };
    const title = clip(body.title, 160);
    const text = clip(body.body, 500);
    if (!title || !text) return { success: false, message: 'عنوان و متن اعلان لازم است.' };
    const result = await sendManual(user.id, {
        title,
        body: text,
        icon: body.icon,
        image: body.image,
        link: body.link || '/',
    });
    if (!result.delivered) {
        return { success: false, message: 'این کاربر اجازه اعلان نداده یا دستگاهی ثبت نشده است.' };
    }
    return { success: true, message: `اعلان آزمایشی برای ${user.username || user.phone || user.id} فرستاده شد.`, delivered: result.delivered };
}

async function handleBroadcast(body) {
    if (!vapid()) return { success: false, message: 'کتابخانه پوش روی سرور آماده نیست.' };
    const title = clip(body.title, 160);
    const text = clip(body.body, 500);
    if (!title || !text) return { success: false, message: 'عنوان و متن اعلان لازم است.' };
    const [users] = await pool.query('SELECT DISTINCT user_id FROM push_subscriptions');
    const note = { title, body: text, icon: body.icon, image: body.image, link: body.link || '/', ruleKey: 'broadcast' };
    setImmediate(() => {
        (async () => {
            for (const user of users) {
                try {
                    await sendManual(user.user_id, note);
                } catch (err) {
                    console.error('[push] broadcast', err.message);
                }
            }
        })().catch((err) => console.error('[push] broadcast', err.message));
    });
    return { success: true, message: `ارسال برای ${users.length} کاربر شروع شد.`, queued: users.length };
}

async function handleGetConfig(_req, res) {
    try {
        const keys = vapid();
        return res.json({ success: true, publicKey: keys ? keys.publicKey : '', configured: Boolean(keys) });
    } catch (err) {
        console.error('[push] config', err.message);
        return res.json({ success: false, message: 'تنظیم پوش در دسترس نیست.' });
    }
}

async function handleSaveSubscription(req, res) {
    try {
        const userId = Number(req.user && req.user.id);
        const endpoint = clip(req.body?.endpoint, 2000);
        const p256dh = clip(req.body?.p256dh, 255);
        const auth = clip(req.body?.auth, 255);
        if (!userId || !endpoint || !p256dh || !auth) {
            return res.json({ success: false, message: 'اطلاعات اشتراک ناقص است.' });
        }
        await ensureSchema();
        const hash = crypto.createHash('sha256').update(endpoint).digest('hex');
        const agent = clip(req.headers['user-agent'], 255);
        await pool.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, p256dh, auth, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                endpoint = VALUES(endpoint),
                p256dh = VALUES(p256dh),
                auth = VALUES(auth),
                user_agent = VALUES(user_agent)`,
            [userId, endpoint, hash, p256dh, auth, agent || null]
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('[push] save', err.message);
        return res.json({ success: false, message: 'ثبت دستگاه انجام نشد.' });
    }
}

async function handleDeleteSubscription(req, res) {
    try {
        const userId = Number(req.user && req.user.id);
        const endpoint = clip(req.body?.endpoint, 2000);
        if (!userId || !endpoint) return res.json({ success: true });
        await ensureSchema();
        const hash = crypto.createHash('sha256').update(endpoint).digest('hex');
        await pool.query('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?', [userId, hash]);
        return res.json({ success: true });
    } catch (err) {
        console.error('[push] delete', err.message);
        return res.json({ success: false });
    }
}

module.exports = {
    ensureSchema,
    startPushScheduler,
    notifyLevelUp,
    notifyPracticeFinished,
    adminOverview,
    saveRule,
    handleTest,
    handleBroadcast,
    handleGetConfig,
    handleSaveSubscription,
    handleDeleteSubscription,
};
