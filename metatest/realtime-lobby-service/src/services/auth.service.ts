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

class AuthService {
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

        try {
            decoded = jwt.verify(token, env.JWT_SECRET) as SupportedJwtPayload | string;
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
        const baseUser = this.verifyAccessToken(token);

        try {
            const profile = await mainBackendService.getUserInfo(token);

            const firstName = profile.first_name ?? null;
            const lastName = profile.last_name ?? null;

            const fullName = [firstName, lastName]
                .filter(Boolean)
                .join(' ')
                .trim();

            return {
                id: String(profile.id ?? baseUser.id),

                username:
                    profile.username ??
                    profile.email ??
                    profile.phone ??
                    baseUser.username,

                displayName:
                    fullName || 'کاربر مهمان',

                avatarUrl:
                    profile.avatar_url ?? '/user_default.png',

                firstName,
                lastName,
                socketId:baseUser.socketId,
                trophies: profile.trophies ?? 0,

            };
        } catch (error) {
            logger.warn(
                {
                    err: error,
                    userId: baseUser.id,
                },
                'Failed to hydrate authenticated user from main backend. Falling back to token payload',
            );

            return baseUser;
        }
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
