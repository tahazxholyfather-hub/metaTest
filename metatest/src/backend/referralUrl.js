'use strict';

function looksLikeLocalUrl(value) {
    return !value || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(String(value));
}

/**
 * Public invite links must open the app.
 * Locally that is http://localhost:5173/invite/:code.
 * On metatest.app the app is mounted at /app, so the link is /app/invite/:code.
 * A root /invite/:code URL is the marketing site and renders an empty page.
 */
function inviteUrlForCode(code, env = process.env, localhost = true) {
    const raw = String((env && (env.FRONTEND_URL || env.BASE_URL)) || '').trim().replace(/\/+$/, '');
    let origin = raw;
    if (!origin || (!localhost && looksLikeLocalUrl(raw))) {
        origin = localhost ? 'http://localhost:5173' : 'https://metatest.app';
    }
    if (!localhost && !/\/app$/i.test(origin)) origin += '/app';
    const token = encodeURIComponent(String(code || '').trim());
    return `${origin}/invite/${token}`;
}

module.exports = { inviteUrlForCode, looksLikeLocalUrl };
