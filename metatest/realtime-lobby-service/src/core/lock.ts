import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { CustomError } from './exceptions/custom-error';

export interface LockManager {
    withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

const RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export class MemoryLockManager implements LockManager {
    private readonly locks = new Map<string, Promise<void>>();

    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const previous = this.locks.get(key) ?? Promise.resolve();
        let releaseLock!: () => void;
        const next = new Promise<void>((resolve) => {
            releaseLock = resolve;
        });
        this.locks.set(key, previous.then(() => next));

        await previous;
        try {
            return await fn();
        } finally {
            releaseLock();
            if (this.locks.get(key) === next) {
                this.locks.delete(key);
            }
        }
    }
}

export class RedisLockManager implements LockManager {
    constructor(
        private readonly redis: Redis,
        private readonly ttlMs = 15_000,
        private readonly waitMs = 8_000,
        private readonly retryMs = 30,
    ) {}

    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const lockKey = `realtime-lobby:lock:${key}`;
        const token = randomUUID();
        const deadline = Date.now() + this.waitMs;

        while (Date.now() < deadline) {
            const acquired = await this.redis.set(lockKey, token, 'PX', this.ttlMs, 'NX');
            if (acquired === 'OK') {
                try {
                    return await fn();
                } finally {
                    await this.redis.eval(RELEASE_LUA, 1, lockKey, token);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, this.retryMs));
        }

        throw new CustomError('Lobby is busy, retry shortly', 429, 'LOCK_TIMEOUT');
    }
}

let lockManager: LockManager | null = null;

export function setLockManager(manager: LockManager): void {
    lockManager = manager;
}

export function getLockManager(): LockManager {
    if (!lockManager) {
        lockManager = new MemoryLockManager();
    }
    return lockManager;
}

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return getLockManager().withLock(key, fn);
}
