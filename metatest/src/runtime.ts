function isOn(value: unknown, fallback = true) {
    if (value == null || String(value).trim() === '') return fallback;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

/** Set by Vite from LOCALHOST in metatest/.env. Unset means local. */
export const isLocalhost = isOn(import.meta.env.VITE_LOCALHOST, true);

export const realtimeUrl = String(
    import.meta.env.VITE_REALTIME_URL
    || import.meta.env.VITE_REALTIME_API_URL
    || (isLocalhost ? 'http://localhost:4000' : 'https://socket.metatest.app'),
).replace(/\/+$/, '');

export const asset = (filePath: string) =>
    `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/, '')}`;

/** Bundled default avatar follows the SPA base. Uploaded files stay at the site root. */
export function avatarSrc(url?: string | null) {
    if (!url || /user_default\.png$/i.test(url)) return asset('avatars/user_default.png');
    if (/^https?:\/\//i.test(url)) return url;
    return url.startsWith('/') ? url : asset(url);
}
