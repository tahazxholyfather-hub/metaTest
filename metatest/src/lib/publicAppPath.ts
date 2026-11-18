/** Absolute URL for a route inside the app, including the /app mount in production. */
export function publicAppUrl(path: string): string {
    const base = String(import.meta.env.BASE_URL || '/');
    const prefix = !base || base === '/' || base === '.' || base === './' ? '' : base.replace(/\/$/, '');
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${window.location.origin}${prefix}${normalized}`;
}
