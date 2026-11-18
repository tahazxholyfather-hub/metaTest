const TOKEN = /^[\w.-]{1,80}$/;

export function safeToken(value) {
    let code = String(value || '').trim();
    try {
        code = decodeURIComponent(code);
    } catch {
        /* keep the raw value when it is not valid percent-encoding */
    }
    code = code.trim();
    return TOKEN.test(code) ? code : '';
}

/** Same destinations as marketing/lib/appUrl.ts, without a trailing slash. */
export function appPrefix(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
        return 'http://localhost:5173';
    }
    return '/app';
}

export function handoffUrl(kind, code, hostname) {
    const token = safeToken(code);
    if (!token || (kind !== 'invite' && kind !== 'join')) return '';
    const leaf = kind === 'join' ? 'lobby' : 'invite';
    return `${appPrefix(hostname)}/${leaf}/${encodeURIComponent(token)}`;
}
