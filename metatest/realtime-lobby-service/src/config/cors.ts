import { env } from './env';
import { logger } from './logger';

export function isAllowedCorsOrigin(origin?: string | null): boolean {
    if (!origin) return true;
    const normalized = origin.replace(/\/+$/, '');
    const allowed = env.CORS_ORIGINS.map((value) => value.replace(/\/+$/, ''));
    if (allowed.includes('*')) return true;
    return allowed.includes(normalized);
}

export function corsOriginDelegate(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
) {
    if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
    }
    logger.warn({ origin }, 'CORS origin rejected');
    callback(null, false);
}

export const corsOptions = {
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
