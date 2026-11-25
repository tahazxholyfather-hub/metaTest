'use strict';

const cookie = require('cookie');

function sessionCookieOptions(req, extra = {}) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const secure = proto === 'https' || process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        ...extra,
    };
}

function setSessionCookie(req, res, token) {
    res.append('Set-Cookie', cookie.serialize('auth_token', token, sessionCookieOptions(req)));
}

function clearSessionCookie(req, res) {
    res.append('Set-Cookie', cookie.serialize('auth_token', '', sessionCookieOptions(req, {
        maxAge: 0,
        expires: new Date(0),
    })));
}

module.exports = { setSessionCookie, clearSessionCookie };
