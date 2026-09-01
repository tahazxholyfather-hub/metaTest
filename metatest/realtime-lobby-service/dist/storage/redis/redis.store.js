"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStore = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
class RedisStore {
    redis;
    prefix = 'realtime-lobby';
    constructor(redisUrl = env_1.env.REDIS_URL) {
        this.redis = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });
        this.redis.on('connect', () => {
            logger_1.logger.info('Redis connected');
        });
        this.redis.on('error', (err) => {
            logger_1.logger.error({ err }, 'Redis error');
        });
    }
    key(...parts) {
        return [this.prefix, ...parts].join(':');
    }
    uid(userId) {
        return String(userId);
    }
    lobbyKey(code) {
        return this.key('lobby', code);
    }
    lobbyCodesKey() {
        return this.key('lobbies');
    }
    membersKey(code) {
        return this.key('lobby', code, 'members');
    }
    progressKey(code) {
        return this.key('lobby', code, 'progress');
    }
    bindingUserKey(userId) {
        return this.key('binding', 'user', userId);
    }
    bindingSocketKey(socketId) {
        return this.key('binding', 'socket', socketId);
    }
    expiryKey(code) {
        return this.key('expiry', code);
    }
    expiriesKey() {
        return this.key('expiries');
    }
    async createLobby(lobby) {
        const pipeline = this.redis.pipeline();
        pipeline.set(this.lobbyKey(lobby.code), JSON.stringify(lobby));
        pipeline.sadd(this.lobbyCodesKey(), lobby.code);
        pipeline.del(this.membersKey(lobby.code));
        pipeline.del(this.progressKey(lobby.code));
        await pipeline.exec();
    }
    async getLobbyByCode(code) {
        const raw = await this.redis.get(this.lobbyKey(code));
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    }
    async updateLobby(code, updater) {
        const key = this.lobbyKey(code);
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await this.redis.watch(key);
            const raw = await this.redis.get(key);
            if (!raw) {
                await this.redis.unwatch();
                return null;
            }
            const existing = JSON.parse(raw);
            const updated = updater(existing);
            const result = await this.redis
                .multi()
                .set(key, JSON.stringify(updated))
                .exec();
            if (result) {
                return updated;
            }
        }
        logger_1.logger.warn({ code }, 'Redis optimistic lobby update failed after retries');
        return this.getLobbyByCode(code);
    }
    async deleteLobby(code) {
        const members = await this.listMembers(code);
        const pipeline = this.redis.pipeline();
        pipeline.del(this.lobbyKey(code));
        pipeline.del(this.membersKey(code));
        pipeline.del(this.progressKey(code));
        pipeline.del(this.expiryKey(code));
        pipeline.srem(this.lobbyCodesKey(), code);
        pipeline.zrem(this.expiriesKey(), code);
        for (const member of members) {
            pipeline.del(this.bindingUserKey(member.userId));
            if (member.socketId) {
                pipeline.del(this.bindingSocketKey(member.socketId));
            }
        }
        await pipeline.exec();
    }
    async getAllLobbies() {
        const codes = await this.redis.smembers(this.lobbyCodesKey());
        if (codes.length === 0) {
            return [];
        }
        const values = await this.redis.mget(codes.map((code) => this.lobbyKey(code)));
        return values
            .filter((value) => Boolean(value))
            .map((value) => JSON.parse(value));
    }
    async bindSocketToUser(binding) {
        const existing = await this.getUserBinding(binding.userId);
        const pipeline = this.redis.pipeline();
        if (existing) {
            pipeline.del(this.bindingSocketKey(existing.socketId));
        }
        pipeline.set(this.bindingUserKey(binding.userId), JSON.stringify(binding));
        pipeline.set(this.bindingSocketKey(binding.socketId), JSON.stringify(binding));
        await pipeline.exec();
    }
    async getUserBinding(userId) {
        const raw = await this.redis.get(this.bindingUserKey(this.uid(userId)));
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    }
    async removeUserBindingBySocketId(socketId) {
        const raw = await this.redis.get(this.bindingSocketKey(socketId));
        if (!raw) {
            return;
        }
        const binding = JSON.parse(raw);
        const pipeline = this.redis.pipeline();
        pipeline.del(this.bindingSocketKey(socketId));
        const current = await this.getUserBinding(binding.userId);
        if (current?.socketId === socketId) {
            pipeline.del(this.bindingUserKey(this.uid(binding.userId)));
        }
        await pipeline.exec();
    }
    async setMember(code, member) {
        const pipeline = this.redis.pipeline();
        pipeline.hset(this.membersKey(code), member.userId, JSON.stringify(member));
        const binding = await this.getUserBinding(member.userId);
        if (binding) {
            const updatedBinding = {
                ...binding,
                lobbyCode: code,
            };
            pipeline.set(this.bindingUserKey(this.uid(member.userId)), JSON.stringify(updatedBinding));
            pipeline.set(this.bindingSocketKey(binding.socketId), JSON.stringify(updatedBinding));
        }
        await pipeline.exec();
    }
    async getMember(code, userId) {
        const raw = await this.redis.hget(this.membersKey(code), this.uid(userId));
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    }
    async removeMember(code, userId) {
        const uid = this.uid(userId);
        const binding = await this.getUserBinding(uid);
        const pipeline = this.redis.pipeline();
        pipeline.hdel(this.membersKey(code), uid);
        pipeline.hdel(this.progressKey(code), uid);
        if (binding?.lobbyCode === code) {
            const updatedBinding = {
                ...binding,
                lobbyCode: undefined,
            };
            pipeline.set(this.bindingUserKey(uid), JSON.stringify(updatedBinding));
            pipeline.set(this.bindingSocketKey(binding.socketId), JSON.stringify(updatedBinding));
        }
        await pipeline.exec();
    }
    async listMembers(code) {
        const values = await this.redis.hvals(this.membersKey(code));
        return values.map((value) => JSON.parse(value));
    }
    async setMemberProgress(code, progress) {
        await this.redis.hset(this.progressKey(code), progress.userId, JSON.stringify(progress));
    }
    async getMemberProgress(code, userId) {
        const raw = await this.redis.hget(this.progressKey(code), this.uid(userId));
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    }
    async listMemberProgress(code) {
        const values = await this.redis.hvals(this.progressKey(code));
        return values.map((value) => JSON.parse(value));
    }
    async scheduleLobbyExpiry(code, expiresAt) {
        const pipeline = this.redis.pipeline();
        pipeline.set(this.expiryKey(code), String(expiresAt));
        pipeline.zadd(this.expiriesKey(), expiresAt, code);
        await pipeline.exec();
    }
    async getLobbyExpiry(code) {
        const raw = await this.redis.get(this.expiryKey(code));
        if (!raw) {
            return null;
        }
        return Number(raw);
    }
    async clearLobbyExpiry(code) {
        const pipeline = this.redis.pipeline();
        pipeline.del(this.expiryKey(code));
        pipeline.zrem(this.expiriesKey(), code);
        await pipeline.exec();
    }
    async cleanupExpiredLobbies(now) {
        const expiredCodes = await this.redis.zrangebyscore(this.expiriesKey(), '-inf', now);
        for (const code of expiredCodes) {
            await this.deleteLobby(code);
        }
        return expiredCodes;
    }
}
exports.RedisStore = RedisStore;
