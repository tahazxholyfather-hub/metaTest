// middleware/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('../db');

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

const requireToken = async (req, res, next) => {
    const action = req.body?.action;

    // 1. PUBLIC ACTIONS BYPASS
    const publicActions = ['send_otp', 'verify_otp', 'password_login', 'admin_login'];
    if (publicActions.includes(action)) {
        return next();
    }

    // 2. DEVELOPER MODE BYPASS
    if (process.env.DEV_MODE === 'true') {
        req.user = { id: 999, role: 'developer' };
        return next();
    }

    // 3. EXTRACT TOKEN
    let token = req.headers['authorization'] || req.headers['x-app-token'];

    if (!token) {
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
        // If JWT fails, check if it's your legacy Base64 Guest Token or APP_TOKEN

        // Base64 Fallback Check
        try {
            // JWTs have 2 dots. If no dots, it might be your old base64 token.
            if (!token.includes('.')) {
                const decodedPayload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
                if (decodedPayload && decodedPayload.id) {
                    req.user = { id: decodedPayload.id, role: decodedPayload.role || 'guest' };
                    return next();
                }
            }
        } catch (base64Err) {
            // Base64 parsing failed, continue to standard error
        }

        // APP_TOKEN Fallback
        if (token === process.env.APP_TOKEN) {
            req.user = { id: 1, role: 'admin' };
            return next();
        }

        // If all validations fail, return appropriate error
        console.log("Token Auth Failed:", err.message);
        return res.status(401).json({
            success: false,
            message: err.name === 'TokenExpiredError' ? 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' : 'توکن نامعتبر است.'
        });
    }
};

module.exports = { requireToken };