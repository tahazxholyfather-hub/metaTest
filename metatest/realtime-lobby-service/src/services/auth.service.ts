import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { CustomError } from '../core/exceptions/custom-error';
import { AuthenticatedUser } from '../core/types/user.types';
import { mainBackendService } from './main-backend.service';

type SupportedJwtPayload = JwtPayload & {
    sub?: string | number;
    id?: string | number;
    userId?: string | number;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    email?: string;
};

type CachedUser = {
    user: AuthenticatedUser;
    expiresAt: number;
};

class AuthService {
    private readonly profileCache = new Map<string, CachedUser>();
    private readonly maxCacheEntries = 2000;

    extractBearerToken(value?: string | null): string {
        if (!value) {
            throw new CustomError('Missing authorization token', 401, 'MISSING_TOKEN');
        }

        if (value.startsWith('Bearer ')) {
            return value.slice(7).trim();
        }

        return value.trim();
    }

    verifyAccessToken(token: string): AuthenticatedUser {
        let decoded: SupportedJwtPayload | string;

        const verifyOptions: jwt.VerifyOptions = {
            algorithms: ['HS256'],
        };
        if (env.JWT_AUDIENCE) verifyOptions.audience = env.JWT_AUDIENCE;
        if (env.JWT_ISSUER) verifyOptions.issuer = env.JWT_ISSUER;

        try {
            decoded = jwt.verify(token, env.JWT_SECRET, verifyOptions) as SupportedJwtPayload | string;
        } catch {
            throw new CustomError('Invalid or expired token', 401, 'INVALID_TOKEN');
        }

        if (!decoded || typeof decoded === 'string') {
            throw new CustomError('Invalid token payload', 401, 'INVALID_TOKEN_PAYLOAD');
        }

        const rawUserId = decoded.sub ?? decoded.userId ?? decoded.id;

        if (rawUserId === undefined || rawUserId === null || rawUserId === '') {
            throw new CustomError(
                'Token does not contain a valid user identifier',
                401,
                'INVALID_TOKEN_SUBJECT',
            );
        }

        const id = String(rawUserId);

        return {
            id,
            username: decoded.username ?? decoded.email ?? `user_${id}`,
            displayName: decoded.displayName ?? decoded.username ?? decoded.email ?? `User ${id}`,
            avatarUrl: decoded.avatarUrl ?? null,

            firstName: null,
            lastName: null,
            socketId:'',
            trophies: 0,

        };
    }

    async getAuthenticatedUser(token: string): Promise<AuthenticatedUser> {
        const cached = this.profileCache.get(token);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.user;
        }

        const baseUser = this.verifyAccessToken(token);

        try {
            const profile = await mainBackendService.getUserInfo(token);

            const firstName = profile.first_name ?? null;
            const lastName = profile.last_name ?? null;

            const fullName = [firstName, lastName]
                .filter(Boolean)
                .join(' ')
                .trim();

            const hydrated: AuthenticatedUser = {
                id: baseUser.id,
                username:
                    profile.username ??
                    profile.email ??
                    profile.phone ??
                    baseUser.username,
                displayName: fullName || baseUser.displayName || 'کاربر مهمان',
                avatarUrl: this.normalizeAvatarUrl(profile.avatar_url) ?? '/user_default.png',
                firstName,
                lastName,
                socketId: baseUser.socketId,
                trophies: profile.trophies ?? 0,
            };

            this.remember(token, hydrated);
            return hydrated;
        } catch (error) {
            logger.warn(
                {
                    userId: baseUser.id,
                },
                'Failed to hydrate authenticated user from main backend. Falling back to token payload',
            );

            this.remember(token, baseUser);
            return baseUser;
        }
    }

    private remember(token: string, user: AuthenticatedUser): void {
        if (env.PROFILE_CACHE_TTL_MS <= 0) return;

        if (this.profileCache.size >= this.maxCacheEntries) {
            const firstKey = this.profileCache.keys().next().value;
            if (firstKey) this.profileCache.delete(firstKey);
        }

        this.profileCache.set(token, {
            user,
            expiresAt: Date.now() + env.PROFILE_CACHE_TTL_MS,
        });
    }

    private normalizeAvatarUrl(value?: string | null): string | null {
        if (!value) {
            return null;
        }

        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }

        const baseUrl = env.MAIN_BACKEND_URL.replace(/\/$/, '');
        const path = value.startsWith('/') ? value : `/${value}`;

        return `${baseUrl}${path}`;
    }
}

export const authService = new AuthService();
