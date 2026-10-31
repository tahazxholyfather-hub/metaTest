'use strict';

const jwt = require('jsonwebtoken');
const pool = require('../db');

let schemaReady = null;

function ensureSchema() {
    if (!schemaReady) {
        schemaReady = pool.query(`
            CREATE TABLE IF NOT EXISTS chemball_scores (
                user_id INT NOT NULL,
                display_name VARCHAR(80) NOT NULL,
                score INT NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                KEY idx_chemball_score (score)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `).catch((err) => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

function userIdFrom(req) {
    if (req.user && req.user.id) return Number(req.user.id) || null;
    let token = req.headers['x-app-token'] || req.headers.authorization || '';
    if (typeof token !== 'string') return null;
    if (token.startsWith('Bearer ')) token = token.slice(7).trim();
    if (!token || !process.env.JWT_SECRET) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return Number(decoded.id) || null;
    } catch {
        return null;
    }
}

async function resolveName(userId, requested) {
    const clean = String(requested || '').trim().slice(0, 80);
    if (clean) return clean;
    const [rows] = await pool.query(
        'SELECT first_name, last_name, username FROM tam24_users WHERE id = ? LIMIT 1',
        [userId]
    );
    const row = rows[0];
    if (!row) return 'بازیکن';
    const full = `${row.first_name || ''} ${row.last_name || ''}`.trim();
    return String(full || row.username || 'بازیکن').slice(0, 80);
}

async function readBoard(currentUserId) {
    await ensureSchema();
    const [rows] = await pool.query(
        `SELECT user_id, display_name, score, updated_at
         FROM chemball_scores
         ORDER BY score DESC, updated_at ASC
         LIMIT 50`
    );
    return rows.map((row) => ({
        id: String(row.user_id),
        name: row.display_name,
        score: Number(row.score) || 0,
        you: currentUserId != null && Number(row.user_id) === Number(currentUserId),
        createdAt: row.updated_at,
        seasonId: null,
    }));
}

async function writeScore(userId, name, score) {
    const id = Number(userId);
    const points = Math.max(0, Math.floor(Number(score) || 0));
    if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, message: 'کاربر نامعتبر است.' };
    }
    if (points <= 0) return { ok: true, saved: false };
    await ensureSchema();
    const displayName = await resolveName(id, name);
    await pool.query(
        `INSERT INTO chemball_scores (user_id, display_name, score)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            score = GREATEST(score, VALUES(score))`,
        [id, displayName, points]
    );
    return { ok: true, saved: true };
}

async function handleGetLeaderboard(req, res) {
    try {
        const leaders = await readBoard(userIdFrom(req));
        return res.json({ success: true, leaders });
    } catch (err) {
        console.error('[chemball] leaderboard', err && err.message);
        return res.status(500).json({ success: false, message: 'جدول امتیاز در دسترس نیست.' });
    }
}

async function handleSaveScore(req, res) {
    try {
        const userId = userIdFrom(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Missing authentication token' });
        const result = await writeScore(userId, req.body?.name, req.body?.score);
        if (!result.ok) return res.json({ success: false, message: result.message });
        return res.json({ success: true, saved: result.saved });
    } catch (err) {
        console.error('[chemball] score', err && err.message);
        return res.status(500).json({ success: false, message: 'ثبت امتیاز انجام نشد.' });
    }
}

module.exports = {
    handleGetLeaderboard,
    handleSaveScore,
};
