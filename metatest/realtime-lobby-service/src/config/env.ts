import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

function loadEnvFile(filePath: string) {
    if (fs.existsSync(filePath)) dotenv.config({ path: filePath });
}

// First file wins. These are the lobby file and the shared LOCALHOST flag.
// Do not load the API .env whole: it sets PORT=3000 and would steal this service.
const envFiles = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
];
for (const filePath of envFiles) loadEnvFile(filePath);

function fillMissing(filePath: string, keys: string[]) {
    if (!fs.existsSync(filePath)) return;
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    for (const key of keys) {
        if (!process.env[key] && parsed[key]) process.env[key] = parsed[key];
    }
    if (!process.env.MAIN_BACKEND_INTERNAL_KEY && parsed.INTERNAL_SERVICE_KEY) {
        process.env.MAIN_BACKEND_INTERNAL_KEY = parsed.INTERNAL_SERVICE_KEY;
    }
}

const apiEnvFiles = [
    path.resolve(process.cwd(), '../src/backend/.env'),
    path.resolve(__dirname, '../../../src/backend/.env'),
    path.resolve(__dirname, '../../../../src/backend/.env'),
];
for (const filePath of apiEnvFiles) {
    fillMissing(filePath, ['JWT_SECRET', 'HASHIDS_SALT', 'LOCALHOST']);
}

function isLocalhostFlag(value: string | undefined) {
    if (value == null || value.trim() === '') return true;
    return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

const localhost = isLocalhostFlag(process.env.LOCALHOST);
const LOCAL_API = 'http://localhost:3000/api';
const HOSTED_API = 'https://metatest.app/api';
const configuredApi = (process.env.MAIN_BACKEND_URL || '').trim().replace(/\/+$/, '');
// LOCALHOST picks the API. A leftover production URL in this file must not
// send a quiz that was just created on this computer to metatest.app.
if (!configuredApi || configuredApi === LOCAL_API || configuredApi === HOSTED_API) {
    process.env.MAIN_BACKEND_URL = localhost ? LOCAL_API : HOSTED_API;
}
if (!process.env.PORT) process.env.PORT = '4000';
if (!process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN = localhost
        ? 'http://localhost:5173,http://127.0.0.1:5173'
        : 'https://metatest.app,https://www.metatest.app';
} else if (localhost) {
    const origins = process.env.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean);
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
        if (!origins.includes(origin)) origins.push(origin);
    }
    process.env.CORS_ORIGIN = origins.join(',');
}

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

    CORS_ORIGIN: z
        .string()
        .default('http://localhost:5173,http://127.0.0.1:5173,https://metatest.app,https://www.metatest.app'),

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
