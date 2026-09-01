"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorage = createStorage;
exports.getStorage = getStorage;
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const memory_store_1 = require("./memory/memory.store");
const redis_store_1 = require("./redis/redis.store");
let storageInstance = null;
function createStorage() {
    if (storageInstance) {
        return storageInstance;
    }
    if (env_1.env.STORAGE_DRIVER === 'redis') {
        logger_1.logger.info('Using Redis storage driver');
        storageInstance = new redis_store_1.RedisStore(env_1.env.REDIS_URL);
        return storageInstance;
    }
    logger_1.logger.warn('Using in-memory storage driver. Do not use this for multi-instance production.');
    storageInstance = new memory_store_1.MemoryStore();
    return storageInstance;
}
function getStorage() {
    return createStorage();
}
