'use strict';

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

function timingSafeEqualStr(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) {
        crypto.timingSafeEqual(ba, ba);
        return false;
    }
    return crypto.timingSafeEqual(ba, bb);
}

const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(String(password), salt, SCRYPT_KEYLEN, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
};

const compareScrypt = (password, storedHash) => {
    return new Promise((resolve, reject) => {
        const parts = String(storedHash || '').split(':');
        if (parts.length !== 2 || !parts[0] || !parts[1]) return resolve(false);
        const [salt, key] = parts;
        crypto.scrypt(String(password), salt, SCRYPT_KEYLEN, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(timingSafeEqualStr(key, derivedKey.toString('hex')));
        });
    });
};

function md5Hex(value) {
    return crypto.createHash('md5').update(String(value), 'utf8').digest('hex');
}

function looksLikeMd5(stored) {
    return /^[a-f0-9]{32}$/i.test(String(stored || '').trim());
}

function looksLikeScrypt(stored) {
    const s = String(stored || '');
    return s.includes(':') && s.split(':').length === 2;
}

/**
 * Verify an admin password against whatever format is stored:
 *   - scrypt `salt:key` (current)
 *   - 32-char hex MD5 (legacy tam24_admins rows)
 *   - hardcoded `Admin@{n}` for username `admin{n}` (pre-DB login scheme)
 *
 * On a successful legacy match, callers should re-hash with scrypt.
 */
async function verifyAdminPassword(admin, password) {
    const stored = String(admin?.password || '');
    const username = String(admin?.username || '');

    if (looksLikeScrypt(stored)) {
        const ok = await compareScrypt(password, stored);
        return { ok, upgrade: false };
    }

    if (looksLikeMd5(stored)) {
        if (timingSafeEqualStr(md5Hex(password).toLowerCase(), stored.toLowerCase())) {
            return { ok: true, upgrade: true };
        }
    }

    const match = username.match(/^admin(\d+)$/i);
    if (match && password === `Admin@${match[1]}`) {
        return { ok: true, upgrade: true };
    }

    return { ok: false, upgrade: false };
}

module.exports = {
    hashPassword,
    compareScrypt,
    verifyAdminPassword,
    looksLikeMd5,
    looksLikeScrypt,
    md5Hex,
};
