import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4001),

    CORS_ORIGIN: z
        .string()
        .default('http://localhost:5173,http://127.0.0.1:5173,https://metatest.app,https://www.metatest.app'),

    JWT_SECRET: z.string().min(10).default('super-secret-change-me'),
    JWT_AUDIENCE: z.string().optional(),
    JWT_ISSUER: z.string().optional(),

    STORAGE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    MAIN_BACKEND_URL: z.string().url(),
    MAIN_BACKEND_FLOW_URL: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    MAIN_BACKEND_INTERNAL_BASE: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
    MAIN_BACKEND_INTERNAL_KEY: z.string().optional(),
    MAIN_BACKEND_API_KEY: z.string().optional(),

    LOBBY_MAX_MEMBERS: z.coerce.number().default(50),
    LOBBY_CODE_LENGTH: z.coerce.number().default(6),
    RESULTS_TTL_SECONDS: z.coerce.number().default(60),
    WAITING_ROOM_JOIN_LOCK_ON_START: z.coerce.boolean().default(true),

    SOCKET_PING_TIMEOUT: z.coerce.number().default(20000),
    SOCKET_PING_INTERVAL: z.coerce.number().default(25000),

    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),
});

const parsed = envSchema.parse(process.env);

const trimmedBackendUrl = parsed.MAIN_BACKEND_URL.replace(/\/+$/, '');
const backendOrigin = trimmedBackendUrl.replace(/\/api$/i, '');
const apiBase = /\/api$/i.test(trimmedBackendUrl)
    ? trimmedBackendUrl
    : `${backendOrigin}/api`;

export const env = {
    ...parsed,
    CORS_ORIGINS: parsed.CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean),
    MAIN_BACKEND_ORIGIN: backendOrigin,
    MAIN_BACKEND_FLOW_URL: (
        parsed.MAIN_BACKEND_FLOW_URL || `${apiBase}/flow`
    ).replace(/\/+$/, ''),
    MAIN_BACKEND_INTERNAL_BASE_URL: (
        parsed.MAIN_BACKEND_INTERNAL_BASE || `${apiBase}/internal`
    ).replace(/\/+$/, ''),
};
