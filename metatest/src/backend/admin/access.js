'use strict';

const cookie = require('cookie');
const pool = require('../db');
const {
    ASSIGNABLE_SECTIONS,
    SUPER_ADMIN_ID,
    resolveSections,
    sectionAllowed,
    sectionsForAction,
    isSuperAdminId,
    sanitizeSectionPatch,
} = require('./sections');

// This branch's admin session is the HttpOnly cookie ADMIN-<loginId>-<ts>.
// loginId is the number in admin1..admin20 (admin1 is the main admin, id 1),
// which is the same identity requireSuperAdmin and the section catalog use.
function readAdminId(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.admin_token;
    if (!token) return null;
    const parts = String(token).split('-');
    if (parts[0] !== 'ADMIN' || !parts[1]) return null;
    const adminId = parseInt(parts[1], 10);
    return Number.isInteger(adminId) && adminId > 0 ? adminId : null;
}

let schemaReady = null;

function ensureAdminSchema() {
    if (!schemaReady) {
        schemaReady = pool.query(`
            CREATE TABLE IF NOT EXISTS tam24_admin_section_access (
                admin_id INT NOT NULL,
                section_key VARCHAR(40) NOT NULL,
                allowed TINYINT(1) NOT NULL DEFAULT 1,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by INT NULL DEFAULT NULL,
                PRIMARY KEY (admin_id, section_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `).catch((err) => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

async function loadSections(adminId) {
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0) return resolveSections(0, []);
    if (id === SUPER_ADMIN_ID) return resolveSections(id, []);
    try {
        await ensureAdminSchema();
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
    user.isSuper = isSuperAdminId(user);
    user.sections = await loadSections(user.id);
    return user;
}

async function attachAdmin(req) {
    const id = readAdminId(req);
    if (!id) return null;
    const sections = await loadSections(id);
    return {
        id,
        username: `admin${id}`,
        role: 'admin',
        isSuper: id === SUPER_ADMIN_ID,
        sections,
    };
}

function catalog() {
    return ASSIGNABLE_SECTIONS.map((section) => ({
        key: section.key,
        label: section.label,
        defaultAllowed: section.defaultAllowed,
    }));
}

async function listAccess() {
    await ensureAdminSchema();
    let named = new Map();
    try {
        const [rows] = await pool.query(
            `SELECT id, username, full_name, role FROM tam24_admins`
        );
        named = new Map(rows.map((row) => [String(row.username).toLowerCase(), row]));
    } catch (err) {
        console.error('listAccess names:', err.message);
    }

    const [grants] = await pool.query(
        `SELECT admin_id, section_key, allowed FROM tam24_admin_section_access`
    );
    const grouped = new Map();
    for (const row of grants) {
        const key = Number(row.admin_id);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }

    const admins = [];
    for (let id = 1; id <= 20; id += 1) {
        const saved = named.get(`admin${id}`);
        const sections = resolveSections(id, grouped.get(id) || []);
        admins.push({
            id,
            username: `admin${id}`,
            fullName: saved?.full_name || '',
            role: saved?.role || 'admin',
            isSuper: id === SUPER_ADMIN_ID,
            sections,
        });
    }
    return { admins, catalog: catalog() };
}

async function saveSections(adminId, input, updatedBy) {
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0 || id > 20) {
        return { ok: false, status: 400, message: 'شناسه ادمین نامعتبر است' };
    }
    if (id === SUPER_ADMIN_ID) {
        return { ok: false, status: 400, message: 'مدیر اصلی همیشه دسترسی کامل دارد.' };
    }
    const patch = sanitizeSectionPatch(input);
    if (!patch) {
        return { ok: false, status: 400, message: 'دسترسی بخشی ارسال نشده.' };
    }

    await ensureAdminSchema();
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

    return { ok: true, sections: await loadSections(id) };
}

module.exports = {
    readAdminId,
    ensureAdminSchema,
    loadSections,
    withSections,
    attachAdmin,
    catalog,
    listAccess,
    saveSections,
    sectionAllowed,
    sectionsForAction,
};
