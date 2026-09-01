"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const custom_error_1 = require("../core/exceptions/custom-error");
const main_backend_service_1 = require("./main-backend.service");
class AuthService {
    extractBearerToken(value) {
        if (!value) {
            throw new custom_error_1.CustomError('Missing authorization token', 401, 'MISSING_TOKEN');
        }
        if (value.startsWith('Bearer ')) {
            return value.slice(7).trim();
        }
        return value.trim();
    }
    verifyAccessToken(token) {
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        }
        catch {
            throw new custom_error_1.CustomError('Invalid or expired token', 401, 'INVALID_TOKEN');
        }
        if (!decoded || typeof decoded === 'string') {
            throw new custom_error_1.CustomError('Invalid token payload', 401, 'INVALID_TOKEN_PAYLOAD');
        }
        const rawUserId = decoded.sub ?? decoded.userId ?? decoded.id;
        if (rawUserId === undefined || rawUserId === null || rawUserId === '') {
            throw new custom_error_1.CustomError('Token does not contain a valid user identifier', 401, 'INVALID_TOKEN_SUBJECT');
        }
        const id = String(rawUserId);
        return {
            id,
            username: decoded.username ?? decoded.email ?? `user_${id}`,
            displayName: decoded.displayName ?? decoded.username ?? decoded.email ?? `User ${id}`,
            avatarUrl: decoded.avatarUrl ?? null,
            firstName: null,
            lastName: null,
            socketId: '',
            trophies: 0,
        };
    }
    async getAuthenticatedUser(token) {
        const baseUser = this.verifyAccessToken(token);
        try {
            const profile = await main_backend_service_1.mainBackendService.getUserInfo(token);
            const firstName = profile.first_name ?? null;
            const lastName = profile.last_name ?? null;
            const fullName = [firstName, lastName]
                .filter(Boolean)
                .join(' ')
                .trim();
            return {
                id: String(profile.id ?? baseUser.id),
                username: profile.username ??
                    profile.email ??
                    profile.phone ??
                    baseUser.username,
                displayName: fullName || 'کاربر مهمان',
                avatarUrl: profile.avatar_url ?? '/user_default.png',
                firstName,
                lastName,
                socketId: baseUser.socketId,
                trophies: profile.trophies ?? 0,
            };
        }
        catch (error) {
            logger_1.logger.warn({
                err: error,
                userId: baseUser.id,
            }, 'Failed to hydrate authenticated user from main backend. Falling back to token payload');
            return baseUser;
        }
    }
    normalizeAvatarUrl(value) {
        if (!value) {
            return null;
        }
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }
        const baseUrl = env_1.env.MAIN_BACKEND_URL.replace(/\/$/, '');
        const path = value.startsWith('/') ? value : `/${value}`;
        return `${baseUrl}${path}`;
    }
}
exports.authService = new AuthService();
