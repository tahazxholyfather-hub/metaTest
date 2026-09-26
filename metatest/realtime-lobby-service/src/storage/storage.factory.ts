import type Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { IStorage } from '../core/interfaces/storage.interface';
import {
    MemoryLockManager,
    RedisLockManager,
    setLockManager,
} from '../core/lock';
import { MemoryStore } from './memory/memory.store';
import { RedisStore } from './redis/redis.store';

let storageInstance: IStorage | null = null;

export function createStorage(): IStorage {
    if (storageInstance) {
        return storageInstance;
    }

    if (env.STORAGE_DRIVER === 'redis') {
        logger.info('Using Redis storage driver');
        const redisStore = new RedisStore(env.REDIS_URL);
        storageInstance = redisStore;
        setLockManager(new RedisLockManager(redisStore.getClient()));
        return storageInstance;
    }

    logger.warn('Using in-memory storage driver. Do not use this for multi-instance production.');
    storageInstance = new MemoryStore();
    setLockManager(new MemoryLockManager());
    return storageInstance;
}

export function getStorage(): IStorage {
    return createStorage();
}

export function getRedisClient(): Redis | null {
    if (storageInstance instanceof RedisStore) {
        return storageInstance.getClient();
    }
    return null;
}

export async function closeStorage(): Promise<void> {
    if (!storageInstance) return;
    await storageInstance.close();
    storageInstance = null;
}
