import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { IStorage } from '../../core/interfaces/storage.interface';
import {
    Lobby,
    LobbyCode,
    LobbyMember,
    LobbyMemberProgress,
    UserSessionBinding,
} from '../../core/types/lobby.types';

export class RedisStore implements IStorage {
    private readonly redis: Redis;

    private readonly prefix = 'realtime-lobby';

    constructor(redisUrl = env.REDIS_URL) {
        this.redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });

        this.redis.on('connect', () => {
            logger.info('Redis connected');
        });

        this.redis.on('error', (err) => {
            logger.error({ err }, 'Redis error');
        });
    }

    private key(...parts: string[]) {
        return [this.prefix, ...parts].join(':');
    }

    private uid(userId: string | number) {
        return String(userId);
    }

    private lobbyKey(code: LobbyCode) {
        return this.key('lobby', code);
    }

    private lobbyCodesKey() {
        return this.key('lobbies');
    }

    private membersKey(code: LobbyCode) {
        return this.key('lobby', code, 'members');
    }

    private progressKey(code: LobbyCode) {
        return this.key('lobby', code, 'progress');
    }

    private bindingUserKey(userId: string) {
        return this.key('binding', 'user', userId);
    }

    private bindingSocketKey(socketId: string) {
        return this.key('binding', 'socket', socketId);
    }

    private expiryKey(code: LobbyCode) {
        return this.key('expiry', code);
    }

    private expiriesKey() {
        return this.key('expiries');
    }

    async createLobby(lobby: Lobby): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.set(this.lobbyKey(lobby.code), JSON.stringify(lobby));
        pipeline.sadd(this.lobbyCodesKey(), lobby.code);
        pipeline.del(this.membersKey(lobby.code));
        pipeline.del(this.progressKey(lobby.code));

        await pipeline.exec();
    }

    async getLobbyByCode(code: LobbyCode): Promise<Lobby | null> {
        const raw = await this.redis.get(this.lobbyKey(code));

        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as Lobby;
    }

    async updateLobby(
        code: LobbyCode,
        updater: (lobby: Lobby) => Lobby,
    ): Promise<Lobby | null> {
        const key = this.lobbyKey(code);

        for (let attempt = 0; attempt < 5; attempt += 1) {
            await this.redis.watch(key);

            const raw = await this.redis.get(key);

            if (!raw) {
                await this.redis.unwatch();
                return null;
            }

            const existing = JSON.parse(raw) as Lobby;
            const updated = updater(existing);

            const result = await this.redis
                .multi()
                .set(key, JSON.stringify(updated))
                .exec();

            if (result) {
                return updated;
            }
        }

        logger.warn({ code }, 'Redis optimistic lobby update failed after retries');
        return this.getLobbyByCode(code);
    }

    async deleteLobby(code: LobbyCode): Promise<void> {
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

    async getAllLobbies(): Promise<Lobby[]> {
        const codes = await this.redis.smembers(this.lobbyCodesKey());

        if (codes.length === 0) {
            return [];
        }

        const values = await this.redis.mget(codes.map((code) => this.lobbyKey(code)));

        return values
            .filter((value): value is string => Boolean(value))
            .map((value) => JSON.parse(value) as Lobby);
    }

    async bindSocketToUser(binding: UserSessionBinding): Promise<void> {
        const existing = await this.getUserBinding(binding.userId);

        const pipeline = this.redis.pipeline();

        if (existing) {
            pipeline.del(this.bindingSocketKey(existing.socketId));
        }

        pipeline.set(this.bindingUserKey(binding.userId), JSON.stringify(binding));
        pipeline.set(this.bindingSocketKey(binding.socketId), JSON.stringify(binding));

        await pipeline.exec();
    }

    async getUserBinding(userId: string | number): Promise<UserSessionBinding | null> {
        const raw = await this.redis.get(this.bindingUserKey(this.uid(userId)));

        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as UserSessionBinding;
    }

    async removeUserBindingBySocketId(socketId: string): Promise<void> {
        const raw = await this.redis.get(this.bindingSocketKey(socketId));

        if (!raw) {
            return;
        }

        const binding = JSON.parse(raw) as UserSessionBinding;

        const pipeline = this.redis.pipeline();

        pipeline.del(this.bindingSocketKey(socketId));

        const current = await this.getUserBinding(binding.userId);

        if (current?.socketId === socketId) {
            pipeline.del(this.bindingUserKey(this.uid(binding.userId)));
        }

        await pipeline.exec();
    }

    async setMember(code: LobbyCode, member: LobbyMember): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.hset(this.membersKey(code), member.userId, JSON.stringify(member));

        const binding = await this.getUserBinding(member.userId);

        if (binding) {
            const updatedBinding: UserSessionBinding = {
                ...binding,
                lobbyCode: code,
            };

            pipeline.set(
                this.bindingUserKey(this.uid(member.userId)),
                JSON.stringify(updatedBinding),
            );

            pipeline.set(
                this.bindingSocketKey(binding.socketId),
                JSON.stringify(updatedBinding),
            );
        }

        await pipeline.exec();
    }

    async getMember(code: LobbyCode, userId: string | number): Promise<LobbyMember | null> {
        const raw = await this.redis.hget(this.membersKey(code), this.uid(userId));

        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as LobbyMember;
    }

    async removeMember(code: LobbyCode, userId: string | number): Promise<void> {
        const uid = this.uid(userId);
        const binding = await this.getUserBinding(uid);

        const pipeline = this.redis.pipeline();

        pipeline.hdel(this.membersKey(code), uid);
        pipeline.hdel(this.progressKey(code), uid);

        if (binding?.lobbyCode === code) {
            const updatedBinding: UserSessionBinding = {
                ...binding,
                lobbyCode: undefined,
            };

            pipeline.set(this.bindingUserKey(uid), JSON.stringify(updatedBinding));
            pipeline.set(
                this.bindingSocketKey(binding.socketId),
                JSON.stringify(updatedBinding),
            );
        }

        await pipeline.exec();
    }

    async listMembers(code: LobbyCode): Promise<LobbyMember[]> {
        const values = await this.redis.hvals(this.membersKey(code));

        return values.map((value) => JSON.parse(value) as LobbyMember);
    }

    async setMemberProgress(
        code: LobbyCode,
        progress: LobbyMemberProgress,
    ): Promise<void> {
        await this.redis.hset(
            this.progressKey(code),
            progress.userId,
            JSON.stringify(progress),
        );
    }

    async getMemberProgress(
        code: LobbyCode,
        userId: string | number,
    ): Promise<LobbyMemberProgress | null> {
        const raw = await this.redis.hget(this.progressKey(code), this.uid(userId));

        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as LobbyMemberProgress;
    }

    async listMemberProgress(code: LobbyCode): Promise<LobbyMemberProgress[]> {
        const values = await this.redis.hvals(this.progressKey(code));

        return values.map((value) => JSON.parse(value) as LobbyMemberProgress);
    }

    async scheduleLobbyExpiry(code: LobbyCode, expiresAt: number): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.set(this.expiryKey(code), String(expiresAt));
        pipeline.zadd(this.expiriesKey(), expiresAt, code);

        await pipeline.exec();
    }

    async getLobbyExpiry(code: LobbyCode): Promise<number | null> {
        const raw = await this.redis.get(this.expiryKey(code));

        if (!raw) {
            return null;
        }

        return Number(raw);
    }

    async clearLobbyExpiry(code: LobbyCode): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.del(this.expiryKey(code));
        pipeline.zrem(this.expiriesKey(), code);

        await pipeline.exec();
    }

    async listExpiredLobbyCodes(now: number): Promise<LobbyCode[]> {
        return this.redis.zrangebyscore(this.expiriesKey(), '-inf', now);
    }

    async cleanupExpiredLobbies(now: number): Promise<LobbyCode[]> {
        const expiredCodes = await this.listExpiredLobbyCodes(now);

        for (const code of expiredCodes) {
            await this.deleteLobby(code);
        }

        return expiredCodes;
    }
}
