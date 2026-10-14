type Bucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function allowSocketEvent(
    socketId: string,
    event: string,
    max: number,
    windowMs: number,
): boolean {
    const now = Date.now();
    const key = `${socketId}:${event}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (bucket.count >= max) {
        return false;
    }

    bucket.count += 1;
    return true;
}

export function clearSocketRateLimit(socketId: string): void {
    for (const key of buckets.keys()) {
        if (key.startsWith(`${socketId}:`)) {
            buckets.delete(key);
        }
    }
}

const EVENT_LIMITS: Record<string, { max: number; windowMs: number }> = {
    'lobby:create': { max: 8, windowMs: 60_000 },
    'lobby:join': { max: 20, windowMs: 10_000 },
    'lobby:rejoin': { max: 20, windowMs: 10_000 },
    'quiz:submit': { max: 6, windowMs: 60_000 },
    'lobby:notify': { max: 8, windowMs: 15_000 },
    notify_lobby: { max: 8, windowMs: 15_000 },
    'member:progress': { max: 30, windowMs: 2_000 },
};

const DEFAULT_LIMIT = { max: 40, windowMs: 5_000 };

export function allowByEvent(socketId: string, event: string): boolean {
    const limit = EVENT_LIMITS[event] ?? DEFAULT_LIMIT;
    return allowSocketEvent(socketId, event, limit.max, limit.windowMs);
}
