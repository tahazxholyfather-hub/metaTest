'use strict';

const pool = require('../db');
const { FREE_LIMITS, CORE_SUBJECTS } = require('./limits');

let ready = null;

async function ensureReady() {
    if (!ready) {
        ready = pool.query(`
            CREATE TABLE IF NOT EXISTS tam24_plan_usage (
                id BIGINT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                feature VARCHAR(40) NOT NULL,
                subject_key VARCHAR(64) NOT NULL DEFAULT '',
                resource_id VARCHAR(64) NOT NULL DEFAULT '',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uniq_plan_usage (user_id, feature, subject_key, resource_id),
                KEY idx_plan_usage_window (user_id, feature, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `).then(() => pool.query(`
            CREATE TABLE IF NOT EXISTS tam24_coin_purchases (
                id BIGINT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                package_id VARCHAR(40) NOT NULL,
                coins INT NOT NULL,
                price_toman INT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                authority VARCHAR(120) NULL,
                ref_id VARCHAR(120) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP NULL,
                PRIMARY KEY (id),
                KEY idx_coin_purchase_user (user_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `)).catch((err) => {
            ready = null;
            throw err;
        });
    }
    return ready;
}

async function withLock(conn, key, fn) {
    const [rows] = await conn.query('SELECT GET_LOCK(?, 8) AS got', [key]);
    if (!rows[0] || Number(rows[0].got) !== 1) {
        const err = new Error('could not lock usage');
        err.code = 'USAGE_LOCK';
        throw err;
    }
    try {
        return await fn();
    } finally {
        try { await conn.query('SELECT RELEASE_LOCK(?)', [key]); } catch { /* ignore */ }
    }
}

function shapeSlot({ allowed, used, limit, already = false, nextAllowedAt = null, usageId = null }) {
    return {
        allowed,
        already,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        nextAllowedAt,
        usageId,
    };
}

/**
 * One free slot per subject. Revisiting the same resource (question) does not
 * consume another slot, so the student can reopen the solution or continue
 * that Ask Met thread.
 */
async function consumeSubjectSlot(conn, { userId, feature, subjectKey, resourceId, limit }, { commit = false } = {}) {
    const lockKey = `plan:${userId}:${feature}:${subjectKey}`;
    return withLock(conn, lockKey, async () => {
        const [existing] = await conn.query(
            `SELECT id FROM tam24_plan_usage
             WHERE user_id = ? AND feature = ? AND subject_key = ? AND resource_id = ? LIMIT 1`,
            [userId, feature, subjectKey, resourceId]
        );
        const [countRows] = await conn.query(
            `SELECT COUNT(*) AS c FROM tam24_plan_usage
             WHERE user_id = ? AND feature = ? AND subject_key = ?`,
            [userId, feature, subjectKey]
        );
        const used = Number(countRows[0]?.c || 0);
        let slot;
        if (existing.length) slot = shapeSlot({ allowed: true, already: true, used, limit });
        else if (used >= limit) slot = shapeSlot({ allowed: false, used, limit });
        else {
            const [ins] = await conn.query(
                `INSERT INTO tam24_plan_usage (user_id, feature, subject_key, resource_id) VALUES (?, ?, ?, ?)`,
                [userId, feature, subjectKey, resourceId]
            );
            slot = shapeSlot({ allowed: true, used: used + 1, limit, usageId: ins.insertId });
        }
        // Commit before the lock drops so a parallel request cannot sneak a second slot in.
        if (commit) await conn.commit();
        return slot;
    });
}

async function claimWindowSlot(conn, { userId, feature, limit, windowHours }, { commit = false } = {}) {
    const lockKey = `plan:${userId}:${feature}`;
    return withLock(conn, lockKey, async () => {
        const [rows] = await conn.query(
            `SELECT id, created_at FROM tam24_plan_usage
             WHERE user_id = ? AND feature = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
             ORDER BY created_at ASC`,
            [userId, feature, windowHours]
        );
        const used = rows.length;
        let slot;
        if (used >= limit) {
            const oldest = rows[0] ? new Date(rows[0].created_at) : new Date();
            const next = new Date(oldest.getTime() + windowHours * 3600 * 1000);
            slot = shapeSlot({ allowed: false, used, limit, nextAllowedAt: next.toISOString() });
        } else {
            const pendingId = `pending:${userId}:${Date.now()}`;
            const [ins] = await conn.query(
                `INSERT INTO tam24_plan_usage (user_id, feature, subject_key, resource_id) VALUES (?, ?, '', ?)`,
                [userId, feature, pendingId]
            );
            slot = shapeSlot({ allowed: true, used: used + 1, limit, usageId: ins.insertId });
        }
        if (commit) await conn.commit();
        return slot;
    });
}

async function bindResource(usageId, resourceId) {
    if (!usageId) return;
    await ensureReady();
    await pool.query(`UPDATE tam24_plan_usage SET resource_id = ? WHERE id = ?`, [String(resourceId), usageId]);
}

async function releaseUsage(usageId) {
    if (!usageId) return;
    try {
        await pool.query(`DELETE FROM tam24_plan_usage WHERE id = ?`, [usageId]);
    } catch { /* ignore */ }
}

async function countSubject(conn, userId, feature, subjectKey) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS c FROM tam24_plan_usage WHERE user_id = ? AND feature = ? AND subject_key = ?`,
        [userId, feature, subjectKey]
    );
    return Number(rows[0]?.c || 0);
}

async function windowStatus(conn, userId, feature, windowHours) {
    const [rows] = await conn.query(
        `SELECT id, created_at FROM tam24_plan_usage
         WHERE user_id = ? AND feature = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         ORDER BY created_at ASC`,
        [userId, feature, windowHours]
    );
    const used = rows.length;
    const limit = FREE_LIMITS.personalExamsPerWindow;
    let nextAllowedAt = null;
    if (used >= limit && rows[0]) {
        nextAllowedAt = new Date(new Date(rows[0].created_at).getTime() + windowHours * 3600 * 1000).toISOString();
    }
    return shapeSlot({ allowed: used < limit, used, limit, nextAllowedAt });
}

async function snapshot(userId) {
    await ensureReady();
    const conn = await pool.getConnection();
    try {
        const solutions = {};
        const askMet = {};
        for (const key of CORE_SUBJECTS) {
            const solutionUsed = await countSubject(conn, userId, 'detailed_solution', key);
            const askUsed = await countSubject(conn, userId, 'ask_met', key);
            solutions[key] = shapeSlot({
                allowed: solutionUsed < FREE_LIMITS.detailedSolutionsPerSubject,
                used: solutionUsed,
                limit: FREE_LIMITS.detailedSolutionsPerSubject,
            });
            askMet[key] = shapeSlot({
                allowed: askUsed < FREE_LIMITS.askMetPerSubject,
                used: askUsed,
                limit: FREE_LIMITS.askMetPerSubject,
            });
        }
        const personalExam = await windowStatus(conn, userId, 'personal_exam', FREE_LIMITS.personalExamWindowHours);
        return { solutions, askMet, personalExam };
    } finally {
        conn.release();
    }
}

module.exports = {
    ensureReady,
    consumeSubjectSlot,
    claimWindowSlot,
    bindResource,
    releaseUsage,
    snapshot,
};
