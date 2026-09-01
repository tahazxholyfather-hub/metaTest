// token.ts
import { getCookie, removeCookie, setCookie } from '../lib/cookies';

const ACCESS_TOKEN_COOKIE = 'auth_token';

export function getAccessToken(): string | null {
    return getCookie(ACCESS_TOKEN_COOKIE);
}

export function setAccessToken(token: string): void {
    setCookie(ACCESS_TOKEN_COOKIE, token, 7);
}

export function removeAccessToken(): void {
    removeCookie(ACCESS_TOKEN_COOKIE);
}
