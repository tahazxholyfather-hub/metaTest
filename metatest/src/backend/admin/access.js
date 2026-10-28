'use strict';

const pool = require('../db');
const {
    ASSIGNABLE_SECTIONS,
    SUPER_ADMIN_ID,
    resolveSections,
    isActionAllowed,
    sanitizeSectionPatch,
    sectionAllowed,
} = require('./sections');

async function loadSections(adminId) {
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0) return resolveSections(0, []);
    if (id === SUPER_ADMIN_ID) return resolveSections(id, []);
    try {
        const [rows] = await pool.query(
            `SELECT section_key, allowed FROM tam24_admin_section_access WHERE admin_id = ?`,
            [id]
        );
        return resolveSections(id, rows);
    } catch (err) {
        console.error('loadSections failed:', err.message);
        return resolveSections(id, []);
    }
}

async function withSections(user) {
    if (!user) return user;
    user.sections = await loadSections(user.id);
    return user;
}

function denyIfActionForbidden(req, res) {
    const action = req.body?.action;
    if (!action) return false;
    if (isActionAllowed(req.admin, action)) return false;
    res.status(403).json({
        success: false,
        message: 'به این بخش دسترسی نداری.',
    });
    return true;
}

function requireSection(...keys) {
    return (req, res, next) => {
        if (sectionAllowed(req.admin, keys)) return next();
        return res.status(403).json({
            success: false,
            message: 'به این بخش دسترسی نداری.',
        });
    };
}

async function listAccess() {
    const [admins] = await pool.query(
        `SELECT id, username, full_name, role, status, last_login, created_at
         FROM tam24_admins ORDER BY id ASC`
    );
    const [grants] = await pool.query(
        `SELECT admin_id, section_key, allowed FROM tam24_admin_section_access`
    );
    const grouped = new Map();
    for (const row of grants) {
        const key = Number(row.admin_id);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }
    return { admins, grouped };
}

async function saveSections(adminId, input, updatedBy) {
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, status: 400, message: 'شناسه ادمین نامعتبر است' };
    }
    if (id === SUPER_ADMIN_ID) {
        return { ok: false, status: 400, message: 'مدیر اصلی همیشه دسترسی کامل دارد.' };
    }
    const patch = sanitizeSectionPatch(input);
    if (!patch) {
        return { ok: false, status: 400, message: 'دسترسی بخشی ارسال نشده.' };
    }

    const [[existing]] = await pool.query(`SELECT id FROM tam24_admins WHERE id = ? LIMIT 1`, [id]);
    if (!existing) return { ok: false, status: 404, message: 'ادمین پیدا نشد' };

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const [key, allowed] of Object.entries(patch)) {
            await connection.query(
                `INSERT INTO tam24_admin_section_access (admin_id, section_key, allowed, updated_by)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_by = VALUES(updated_by)`,
                [id, key, allowed ? 1 : 0, updatedBy || null]
            );
        }
        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }

    const [rows] = await pool.query(
        `SELECT section_key, allowed FROM tam24_admin_section_access WHERE admin_id = ?`,
        [id]
    );
    return { ok: true, sections: resolveSections(id, rows) };
}

function catalog() {
    return ASSIGNABLE_SECTIONS.map((section) => ({
        key: section.key,
        label: section.label,
        defaultAllowed: section.defaultAllowed,
    }));
}

module.exports = {
    loadSections,
    withSections,
    denyIfActionForbidden,
    requireSection,
    listAccess,
    saveSections,
    catalog,
};
