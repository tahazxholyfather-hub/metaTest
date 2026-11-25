// token.ts
import { getCookie, removeCookie, setCookie } from '../lib/cookies';

const ACCESS_TOKEN_COOKIE = 'auth_token';

export function getAccessToken(): string | null {
    return getCookie(ACCESS_TOKEN_COOKIE);
}

/** Short-lived token for socket.metatest.app. The session cookie itself is HttpOnly. */
export async function fetchRealtimeToken(): Promise<string | null> {
    const res = await fetch('/api/realtime-token', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return typeof data?.token === 'string' ? data.token : null;
}

export function setAccessToken(token: string): void {
    setCookie(ACCESS_TOKEN_COOKIE, token, 7);
}

export function removeAccessToken(): void {
    removeCookie(ACCESS_TOKEN_COOKIE);
}
