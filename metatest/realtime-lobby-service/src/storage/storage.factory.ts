import { env } from '../config/env';
import { logger } from '../config/logger';
import { IStorage } from '../core/interfaces/storage.interface';
import { MemoryStore } from './memory/memory.store';
import { RedisStore } from './redis/redis.store';

let storageInstance: IStorage | null = null;

export function createStorage(): IStorage {
    if (storageInstance) {
        return storageInstance;
    }

    if (env.STORAGE_DRIVER === 'redis') {
        logger.info('Using Redis storage driver');
        storageInstance = new RedisStore(env.REDIS_URL);
        return storageInstance;
    }

    logger.warn('Using in-memory storage driver. Do not use this for multi-instance production.');
    storageInstance = new MemoryStore();

    return storageInstance;
}

export function getStorage(): IStorage {
    return createStorage();
}
