'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function isLocalhostFlag(value, fallback = true) {
    if (value == null || String(value).trim() === '') return fallback;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function homeFromBackendDir(backendDir) {
    const parts = path.resolve(backendDir).split(path.sep).filter(Boolean);
    // /home/tamapp/backend -> /home/tamapp. /home/public is not an account.
    if ((parts[0] === 'home' || parts[0] === 'Users') && parts[1] && parts[1] !== 'public') {
        return path.join(path.sep, parts[0], parts[1]);
    }
    return '';
}

function accountHome(env = process.env, backendDir = __dirname) {
    const raw = env.HOME ? String(env.HOME).trim() : '';
    if (raw && path.isAbsolute(raw)) {
        const home = path.resolve(raw);
        // LiteSpeed sometimes leaves HOME at /home, which is not this account.
        if (home !== '/' && home !== '/home' && home !== '/Users') return home;
    }
    const fromBackend = homeFromBackendDir(backendDir);
    if (fromBackend) return fromBackend;
    try {
        const home = os.homedir();
        if (home && path.isAbsolute(home)) {
            const resolved = path.resolve(home);
            if (resolved !== '/' && resolved !== '/home' && resolved !== '/Users') return resolved;
        }
    } catch (_) {}
    return path.resolve(backendDir, '..');
}

function cpanelWebRoot(env = process.env, backendDir = __dirname) {
    const raw = String(env.WEB_ROOT || '').trim();
    const home = accountHome(env, backendDir);
    if (raw) {
        // A relative WEB_ROOT must not use the process cwd. On cPanel that cwd is often /home.
        return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(home, raw);
    }
    const documentRoot = String(env.DOCUMENT_ROOT || '').trim();
    if (documentRoot && path.isAbsolute(documentRoot)) return path.resolve(documentRoot);
    return path.join(home, 'public_html');
}

function profileFromEnv(env = process.env, options = {}) {
    const localhost = isLocalhostFlag(env.LOCALHOST, true);
    const backendDir = options.backendDir || __dirname;
    const repoPublic = path.resolve(backendDir, '../../public');
    const repoPublicExists = options.publicExists != null
        ? Boolean(options.publicExists)
        : fs.existsSync(repoPublic);
    const cpanelRoot = cpanelWebRoot(env, backendDir);
    // Dev layout is metatest/src/backend. A cPanel app root of /home/<user>/backend
    // makes ../../public resolve to /home/public, which this account cannot create.
    const webRoot = localhost && repoPublicExists ? repoPublic : cpanelRoot;
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

function tryMkdir(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
    } catch (_) {
        return false;
    }
}

function ensureAvatarDir(target = profile, env = process.env) {
    const home = accountHome(env);
    const candidates = [
        target.avatarDir,
        path.join(cpanelWebRoot(env), 'avatars'),
        path.join(home, 'public_html', 'avatars'),
        path.resolve(__dirname, '../public_html/avatars'),
        path.join(__dirname, 'avatars'),
    ];
    const seen = new Set();
    for (const candidate of candidates) {
        const dir = path.resolve(candidate);
        if (seen.has(dir)) continue;
        seen.add(dir);
        if (!tryMkdir(dir)) continue;
        if (dir !== path.resolve(target.avatarDir)) {
            console.warn(`[runtime] cannot use ${target.avatarDir}; avatars -> ${dir}`);
        }
        target.avatarDir = dir;
        if (path.basename(dir) === 'avatars') target.webRoot = path.dirname(dir);
        return dir;
    }

    const fallback = path.join(os.tmpdir(), 'metatest-avatars');
    try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
    console.warn(`[runtime] avatar folders were not writable; using ${fallback}`);
    target.avatarDir = fallback;
    return fallback;
}

const profile = profileFromEnv();

module.exports = {
    isLocalhostFlag,
    profileFromEnv,
    ensureAvatarDir,
    profile,
};
