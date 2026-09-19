'use strict';

const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const pool = require('../db');
const { hashPassword, verifyAdminPassword } = require('../utils/password');

const COOKIE_NAME = 'admin_token';
const SUPER_ADMIN_ID = 1;
const LOCK_AFTER_FAILURES = 5;
const LOCK_MINUTES = 15;
const TOKEN_DAYS = 7;

const loginHits = new Map();

function getAdminJwtSecret() {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('ADMIN_JWT_SECRET or JWT_SECRET must be set');
    }
    return process.env.ADMIN_JWT_SECRET || `${secret}:admin-panel`;
}

function isAdminAction(action) {
    return typeof action === 'string' && /^admin_/i.test(action);
}

function readCookieToken(req) {
    if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
    const parsed = cookie.parse(req.headers.cookie || '');
    return parsed[COOKIE_NAME] || null;
}

function extractAdminToken(req) {
    const header = req.headers['x-admin-token'];
    if (header && String(header).trim()) return String(header).trim();
    return readCookieToken(req);
}

function cookieOptions({ clear = false } = {}) {
    const isProd = process.env.NODE_ENV === 'production';
    const base = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
    };
    if (clear) {
        return { ...base, expires: new Date(0), maxAge: 0 };
    }
    return { ...base, maxAge: 60 * 60 * 24 * TOKEN_DAYS };
}

function setAdminCookie(res, token) {
    res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, token, cookieOptions()));
}

function clearAdminCookie(res) {
    res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', cookieOptions({ clear: true })));
}

function publicAdmin(row) {
    if (!row) return null;
    const id = Number(row.id);
    return {
        id,
        username: row.username,
        fullName: row.full_name || row.fullName || '',
        role: row.role || 'admin',
        status: row.status || 'active',
        isSuper: id === SUPER_ADMIN_ID,
        lastLogin: row.last_login || null,
        createdAt: row.created_at || null,
    };
}

function isSuperAdmin(admin) {
    return Number(admin?.id) === SUPER_ADMIN_ID;
}

async function loadAdminById(id) {
    const [rows] = await pool.query(
        `SELECT id, username, full_name, role, status, last_login, created_at
         FROM tam24_admins WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0] || null;
}

async function loadAdminByUsername(username) {
    const [rows] = await pool.query(
        `SELECT id, username, password, full_name, role, status, last_login, created_at,
                failed_attempts, locked_until
         FROM tam24_admins WHERE username = ? LIMIT 1`,
        [username]
    );
    return rows[0] || null;
}

function clientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
    return req.socket?.remoteAddress || null;
}

function loginRateLimited(req) {
    const key = clientIp(req) || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000;
    const arr = (loginHits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= 20) return true;
    arr.push(now);
    loginHits.set(key, arr);
    return false;
}

function signAdminToken(admin) {
    const loginAt = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            kind: 'admin',
            id: Number(admin.id),
            username: admin.username,
            role: admin.role || 'admin',
            loginAt,
        },
        getAdminJwtSecret(),
        { expiresIn: `${TOKEN_DAYS}d` }
    );
}

async function issueSession(res, admin) {
    const token = signAdminToken(admin);
    setAdminCookie(res, token);
    return publicAdmin(admin);
}

async function recordLoginSuccess(adminId, ip) {
    await pool.query(
        `UPDATE tam24_admins
            SET last_login = NOW(), last_login_ip = ?, failed_attempts = 0, locked_until = NULL
          WHERE id = ?`,
        [ip, adminId]
    );
}

async function recordLoginFailure(adminId) {
    await pool.query(
        `UPDATE tam24_admins
            SET failed_attempts = failed_attempts + 1,
                locked_until = CASE
                    WHEN failed_attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
                    ELSE locked_until
                END
          WHERE id = ?`,
        [LOCK_AFTER_FAILURES, LOCK_MINUTES, adminId]
    );
}

async function authenticateAdmin(username, password) {
    const admin = await loadAdminByUsername(String(username || '').trim());
    if (!admin) return { ok: false, message: 'Invalid credentials' };

    if (String(admin.status || 'active') !== 'active') {
        return { ok: false, message: 'This admin account is disabled' };
    }

    if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
        return { ok: false, message: 'Account temporarily locked. Try again later.' };
    }

    const result = await verifyAdminPassword(admin, password);
    if (!result.ok) {
        await recordLoginFailure(admin.id);
        return { ok: false, message: 'Invalid credentials' };
    }

    if (result.upgrade) {
        const hashed = await hashPassword(password);
        await pool.query(`UPDATE tam24_admins SET password = ? WHERE id = ?`, [hashed, admin.id]);
    }

    return { ok: true, admin };
}

function unauthorized(res, message = 'Admin authentication required') {
    return res.status(401).json({ success: false, message });
}

async function attachAdminIfPresent(req) {
    const token = extractAdminToken(req);
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, getAdminJwtSecret());
        if (decoded.kind !== 'admin' || !decoded.id) return null;
        const admin = await loadAdminById(decoded.id);
        if (!admin || String(admin.status || 'active') !== 'active') return null;
        req.admin = publicAdmin(admin);
        return req.admin;
    } catch {
        return null;
    }
}

async function requireAdminSession(req, res, next) {
    const token = extractAdminToken(req);
    if (!token) return unauthorized(res);

    try {
        const decoded = jwt.verify(token, getAdminJwtSecret());
        if (decoded.kind !== 'admin' || !decoded.id) {
            return unauthorized(res, 'Invalid admin session');
        }
        const admin = await loadAdminById(decoded.id);
        if (!admin) return unauthorized(res, 'Invalid admin session');
        if (String(admin.status || 'active') !== 'active') {
            return unauthorized(res, 'This admin account is disabled');
        }
        req.admin = publicAdmin(admin);
        return next();
    } catch {
        return unauthorized(res, 'Invalid admin session');
    }
}

function requireSuperAdmin(req, res, next) {
    if (!req.admin) return unauthorized(res);
    if (!isSuperAdmin(req.admin)) {
        return res.status(403).json({
            success: false,
            message: 'Only the main admin (id 1) can access this section.',
        });
    }
    return next();
}

async function columnExists(table, column) {
    try {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
        );
        return Number(rows[0]?.c) > 0;
    } catch {
        return false;
    }
}

async function ensureColumn(table, column, definition) {
    if (await columnExists(table, column)) return;
    try {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    } catch (err) {
        if (err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060)) return;
        throw err;
    }
}

async function ensureAdminSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tam24_admins (
            id INT NOT NULL AUTO_INCREMENT,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            role VARCHAR(50) NOT NULL DEFAULT 'admin',
            PRIMARY KEY (id),
            UNIQUE KEY username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci
    `);

    await ensureColumn('tam24_admins', 'status', `ENUM('active','disabled') NOT NULL DEFAULT 'active'`);
    await ensureColumn('tam24_admins', 'last_login', 'TIMESTAMP NULL DEFAULT NULL');
    await ensureColumn('tam24_admins', 'last_login_ip', 'VARCHAR(45) NULL DEFAULT NULL');
    await ensureColumn('tam24_admins', 'failed_attempts', 'INT NOT NULL DEFAULT 0');
    await ensureColumn('tam24_admins', 'locked_until', 'TIMESTAMP NULL DEFAULT NULL');
    await ensureColumn('tam24_admins', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await ensureColumn('tam24_admins', 'created_by', 'INT NULL DEFAULT NULL');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tam24_ai_admin_settings (
            id TINYINT NOT NULL DEFAULT 1,
            settings_json JSON NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by INT NULL DEFAULT NULL,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await ensureSuperAdmin();
}

async function ensureSuperAdmin() {
    const [[existing]] = await pool.query(`SELECT id FROM tam24_admins WHERE id = ? LIMIT 1`, [SUPER_ADMIN_ID]);
    if (existing) return;

    const desiredUser = String(process.env.ADMIN_SUPER_USERNAME || 'admin').trim() || 'admin';
    const [[taken]] = await pool.query(`SELECT id FROM tam24_admins WHERE username = ? LIMIT 1`, [desiredUser]);
    const username = taken ? 'superadmin' : desiredUser;
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin@1';
    const hashed = await hashPassword(bootstrapPassword);

    await pool.query(
        `INSERT INTO tam24_admins (id, username, password, full_name, role, status)
         VALUES (?, ?, ?, ?, 'super', 'active')`,
        [SUPER_ADMIN_ID, username, hashed, 'مدیر اصلی']
    );
    console.log(`[admin-auth] Seeded super admin id=${SUPER_ADMIN_ID} username=${username}. Change the bootstrap password immediately.`);
}

module.exports = {
    COOKIE_NAME,
    SUPER_ADMIN_ID,
    isAdminAction,
    extractAdminToken,
    setAdminCookie,
    clearAdminCookie,
    publicAdmin,
    isSuperAdmin,
    loadAdminById,
    loadAdminByUsername,
    clientIp,
    loginRateLimited,
    signAdminToken,
    issueSession,
    recordLoginSuccess,
    authenticateAdmin,
    attachAdminIfPresent,
    requireAdminSession,
    requireSuperAdmin,
    ensureAdminSchema,
    getAdminJwtSecret,
};
