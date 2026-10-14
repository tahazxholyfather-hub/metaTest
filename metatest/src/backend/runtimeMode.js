'use strict';

const path = require('path');

function isLocalhostFlag(value, fallback = true) {
    if (value == null || String(value).trim() === '') return fallback;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function profileFromEnv(env = process.env) {
    const localhost = isLocalhostFlag(env.LOCALHOST, true);
    const repoPublic = path.resolve(__dirname, '../../public');
    const cpanelRoot = env.WEB_ROOT
        ? path.resolve(env.WEB_ROOT)
        : path.resolve(env.HOME || '', 'public_html');
    const webRoot = localhost ? repoPublic : cpanelRoot;
    const extraOrigins = String(env.FRONTEND_ORIGIN || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const corsOrigins = localhost
        ? ['http://localhost:5173', 'http://127.0.0.1:5173']
        : ['https://metatest.app', 'https://www.metatest.app'];

    return {
        localhost,
        appBase: localhost ? '/' : '/app/',
        socketUrl: localhost ? 'http://localhost:4000' : 'https://socket.metatest.app',
        apiBase: localhost ? 'http://localhost:3000/api' : 'https://metatest.app/api',
        frontendOrigin: localhost ? 'http://localhost:5173' : 'https://metatest.app',
        webRoot,
        avatarDir: path.join(webRoot, 'avatars'),
        corsOrigins: [...new Set([...corsOrigins, ...extraOrigins])],
        lobbyPort: Number(env.PORT) || 4000,
    };
}

const profile = profileFromEnv();

module.exports = {
    isLocalhostFlag,
    profileFromEnv,
    profile,
};
