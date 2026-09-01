"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().default(4001),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    JWT_SECRET: zod_1.z.string().min(10).default('super-secret-change-me'),
    JWT_AUDIENCE: zod_1.z.string().optional(),
    JWT_ISSUER: zod_1.z.string().optional(),
    STORAGE_DRIVER: zod_1.z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    MAIN_BACKEND_URL: zod_1.z.string().url(),
    MAIN_BACKEND_INTERNAL_KEY: zod_1.z.string().optional(),
    MAIN_BACKEND_API_KEY: zod_1.z.string().optional(),
    LOBBY_MAX_MEMBERS: zod_1.z.coerce.number().default(50),
    LOBBY_CODE_LENGTH: zod_1.z.coerce.number().default(6),
    RESULTS_TTL_SECONDS: zod_1.z.coerce.number().default(60),
    WAITING_ROOM_JOIN_LOCK_ON_START: zod_1.z.coerce.boolean().default(true),
    SOCKET_PING_TIMEOUT: zod_1.z.coerce.number().default(20000),
    SOCKET_PING_INTERVAL: zod_1.z.coerce.number().default(25000),
    LOG_LEVEL: zod_1.z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),
});
const parsed = envSchema.parse(process.env);
exports.env = {
    ...parsed,
    CORS_ORIGINS: parsed.CORS_ORIGIN.split(',').map((v) => v.trim()),
};
