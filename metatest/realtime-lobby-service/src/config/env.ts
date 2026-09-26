import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4001),

    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    JWT_SECRET: z.string().min(10).default('super-secret-change-me'),
    JWT_AUDIENCE: z.string().optional(),
    JWT_ISSUER: z.string().optional(),

    STORAGE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    MAIN_BACKEND_URL: z.string().url(),
    MAIN_BACKEND_INTERNAL_KEY: z.string().optional(),
    MAIN_BACKEND_API_KEY: z.string().optional(),

    LOBBY_MAX_MEMBERS: z.coerce.number().default(50),
    LOBBY_CODE_LENGTH: z.coerce.number().default(6),
    RESULTS_TTL_SECONDS: z.coerce.number().default(60),
    WAITING_ROOM_JOIN_LOCK_ON_START: z.coerce.boolean().default(true),
    DISCONNECT_GRACE_MS: z.coerce.number().int().min(0).max(15_000).default(3000),

    SOCKET_PING_TIMEOUT: z.coerce.number().default(20000),
    SOCKET_PING_INTERVAL: z.coerce.number().default(25000),

    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),
});

const parsed = envSchema.parse(process.env);

export const env = {
    ...parsed,
    CORS_ORIGINS: parsed.CORS_ORIGIN.split(',').map((v) => v.trim()),
};
