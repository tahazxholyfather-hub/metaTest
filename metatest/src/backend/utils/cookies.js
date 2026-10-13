'use strict';

// Local Cookie header helpers. The `cookie` package is not a backend dependency,
// and cookie@2 removes parse/serialize, which aborted admin requests.

function parseCookieHeader(header) {
    const out = Object.create(null);
    const str = Array.isArray(header) ? header.join('; ') : String(header || '');
    if (str.length < 2) return out;

    let index = 0;
    while (index < str.length) {
        const eq = str.indexOf('=', index);
        if (eq === -1) break;
        let end = str.indexOf(';', index);
        if (end === -1) end = str.length;
        else if (eq > end) {
            index = end + 1;
            continue;
        }

        const key = str.slice(index, eq).trim();
        let val = str.slice(eq + 1, end).trim();
        if (val.length >= 2 && val.charCodeAt(0) === 0x22 && val.charCodeAt(val.length - 1) === 0x22) {
            val = val.slice(1, -1);
        }
        if (key && !Object.prototype.hasOwnProperty.call(out, key)) {
            try {
                out[key] = val.indexOf('%') === -1 ? val : decodeURIComponent(val);
            } catch {
                out[key] = val;
            }
        }
        index = end + 1;
    }
    return out;
}

function serializeCookie(name, value, opt = {}) {
    let str = `${name}=${encodeURIComponent(value == null ? '' : String(value))}`;

    if (opt.maxAge != null) {
        const maxAge = Math.floor(Number(opt.maxAge));
        if (!Number.isFinite(maxAge)) {
            throw new TypeError('option maxAge is invalid');
        }
        str += `; Max-Age=${maxAge}`;
    }
    if (opt.path) str += `; Path=${opt.path}`;
    if (opt.expires) str += `; Expires=${opt.expires.toUTCString()}`;
    if (opt.httpOnly) str += '; HttpOnly';
    if (opt.secure) str += '; Secure';
    if (opt.sameSite) {
        const sameSite = String(opt.sameSite).toLowerCase();
        if (sameSite === 'lax') str += '; SameSite=Lax';
        else if (sameSite === 'strict') str += '; SameSite=Strict';
        else if (sameSite === 'none') str += '; SameSite=None';
        else throw new TypeError('option sameSite is invalid');
    }
    return str;
}

module.exports = {
    parseCookieHeader,
    serializeCookie,
};
