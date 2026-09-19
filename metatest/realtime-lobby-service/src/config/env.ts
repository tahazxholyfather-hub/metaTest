import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (value: unknown) =>
    value === '' || value === undefined || value === null ? undefined : value;

const booleanFromEnv = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    }
    return value;
}, z.boolean());

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4001),

    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    JWT_SECRET: z.string().min(16),
    JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    JWT_ISSUER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

    STORAGE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    MAIN_BACKEND_URL: z.string().url(),
    MAIN_BACKEND_FLOW_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    MAIN_BACKEND_INTERNAL_BASE: z.preprocess(emptyToUndefined, z.string().url().optional()),
    MAIN_BACKEND_INTERNAL_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    MAIN_BACKEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

    HASHIDS_SALT: z.string().optional(),

    LOBBY_MAX_MEMBERS: z.coerce.number().int().min(2).max(200).default(50),
    LOBBY_CODE_LENGTH: z.coerce.number().int().min(4).max(16).default(6),
    RESULTS_TTL_SECONDS: z.coerce.number().int().min(10).default(60),
    WAITING_ROOM_JOIN_LOCK_ON_START: booleanFromEnv.default(true),
    DISCONNECT_GRACE_MS: z.coerce.number().int().min(0).max(15_000).default(3000),
    PROFILE_CACHE_TTL_MS: z.coerce.number().int().min(0).default(45_000),

    SOCKET_PING_TIMEOUT: z.coerce.number().default(25000),
    SOCKET_PING_INTERVAL: z.coerce.number().default(20000),

    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),
});

const parsed = envSchema.parse(process.env);

const trimmedBackendUrl = parsed.MAIN_BACKEND_URL.replace(/\/$/, '');
const backendOrigin = trimmedBackendUrl.replace(/\/api$/i, '');

export const env = {
    ...parsed,
    CORS_ORIGINS: parsed.CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean),
    MAIN_BACKEND_ORIGIN: backendOrigin,
    MAIN_BACKEND_FLOW_URL: (
        parsed.MAIN_BACKEND_FLOW_URL || `${backendOrigin}/api/flow`
    ).replace(/\/$/, ''),
    MAIN_BACKEND_INTERNAL_BASE_URL: (
        parsed.MAIN_BACKEND_INTERNAL_BASE || `${trimmedBackendUrl}/internal`
    ).replace(/\/$/, ''),
};
