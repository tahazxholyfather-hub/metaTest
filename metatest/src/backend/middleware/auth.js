// middleware/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { clearSessionCookie } = require('../utils/sessionCookie');

/**
 * Single-device session check.
 * Login handlers stamp `last_login` and embed the same moment inside the JWT
 * as `loginAt` (unix seconds). If a newer login happened after this token was
 * issued (i.e. the user signed in on another device), this token is rejected.
 * Legacy tokens without `loginAt` are not affected.
 */
const SESSION_GRACE_SECONDS = 5;

const isSessionReplaced = async (decoded) => {
    if (!decoded || !decoded.id || !decoded.loginAt) return false;
    try {
        const [rows] = await db.query(
            'SELECT UNIX_TIMESTAMP(last_login) AS lastLogin FROM tam24_users WHERE id = ? LIMIT 1',
            [decoded.id]
        );
        if (rows.length === 0 || !rows[0].lastLogin) return false;
        return Number(rows[0].lastLogin) > Number(decoded.loginAt) + SESSION_GRACE_SECONDS;
    } catch (err) {
        // Fail open on DB errors so a transient outage doesn't lock everyone out
        console.error('Single-session check failed:', err.message);
        return false;
    }
};

const { isAdminAction, requireAdminSession } = require('./adminAuth');

const requireToken = async (req, res, next) => {
    const action = req.body?.action;

    // 1. PUBLIC ACTIONS BYPASS (student auth + admin login/logout)
    const publicActions = ['send_otp', 'verify_otp', 'password_login', 'admin_login', 'admin_logout', 'admin_verify'];
    if (publicActions.includes(action)) {
        return next();
    }

    // 1b. ADMIN PANEL ACTIONS — independent of the student JWT.
    // Admin login/logout are public above; every other admin_* / Admin_* action
    // needs the admin_token cookie (not the main app's auth_token).
    if (isAdminAction(action)) {
        return requireAdminSession(req, res, next);
    }

    // 2. DEVELOPER MODE BYPASS — local loopback only, never on a public host.
    const remoteAddr = req.socket?.remoteAddress || '';
    const isLoopback = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    if (process.env.DEV_MODE === 'true' && process.env.NODE_ENV !== 'production' && isLoopback) {
        req.user = { id: 999, role: 'developer' };
        return next();
    }

    // 3. EXTRACT TOKEN
    let token = req.headers['authorization'] || req.headers['x-app-token'];
    if (!token || token === 'null' || token === 'undefined') {
        token = req.cookies?.auth_token || '';
    }

    if (!token) {
        clearSessionCookie(req, res);
        return res.status(401).json({ success: false, message: 'Missing authentication token' });
    }

    // Clean up "Bearer " prefix FIRST
    if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Empty authentication token' });
    }

    // 4. JWT AUTHENTICATION
    try {
        // Verify standard JWT
        // Make sure process.env.JWT_SECRET is set in your .env file!
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4.1 Single-device enforcement: reject tokens superseded by a newer login
        if (await isSessionReplaced(decoded)) {
            clearSessionCookie(req, res);
            return res.status(401).json({
                success: false,
                code: 'SESSION_REPLACED',
                message: 'حساب شما در دستگاه دیگری وارد شده است. برای ادامه دوباره وارد شوید.'
            });
        }

        // Attach the decoded payload (e.g., { id: 123, role: 'user' }) to the request
        req.user = decoded;
        return next();

    } catch (err) {
        console.log("Token Auth Failed:", err.message);
        clearSessionCookie(req, res);
        return res.status(401).json({
            success: false,
            message: err.name === 'TokenExpiredError' ? 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' : 'توکن نامعتبر است.'
        });
    }
};

async function attachUserIfPresent(req, _res, next) {
    try {
        let token = req.headers['authorization'] || req.headers['x-app-token'];
        if (!token || process.env.DEV_MODE === 'true') return next();
        if (String(token).startsWith('Bearer ')) token = String(token).slice(7).trim();
        if (!token || !process.env.JWT_SECRET) return next();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!(await isSessionReplaced(decoded))) req.user = decoded;
    } catch (_) {
        // Shop listing stays public when the token is missing or stale.
    }
    return next();
}

module.exports = { requireToken, attachUserIfPresent };