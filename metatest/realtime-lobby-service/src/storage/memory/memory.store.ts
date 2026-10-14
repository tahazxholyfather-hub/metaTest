import { IStorage } from '../../core/interfaces/storage.interface';
import {
    Lobby,
    LobbyCode,
    LobbyMember,
    LobbyMemberProgress,
    UserSessionBinding,
} from '../../core/types/lobby.types';

export class MemoryStore implements IStorage {
    private readonly lobbies = new Map<LobbyCode, Lobby>();
    private readonly members = new Map<LobbyCode, Map<string, LobbyMember>>();
    private readonly progress = new Map<LobbyCode, Map<string, LobbyMemberProgress>>();
    private readonly bindingsByUserId = new Map<string, UserSessionBinding>();
    private readonly bindingsBySocketId = new Map<string, UserSessionBinding>();
    private readonly expiries = new Map<LobbyCode, number>();

    private key(userId: string | number) {
        return String(userId);
    }

    private getMembersMap(code: LobbyCode): Map<string, LobbyMember> {
        let map = this.members.get(code);
        if (!map) {
            map = new Map();
            this.members.set(code, map);
        }
        return map;
    }

    private getProgressMap(code: LobbyCode): Map<string, LobbyMemberProgress> {
        let map = this.progress.get(code);
        if (!map) {
            map = new Map();
            this.progress.set(code, map);
        }
        return map;
    }

    async createLobby(lobby: Lobby): Promise<void> {
        this.lobbies.set(lobby.code, { ...lobby, seq: lobby.seq ?? 0 });
        this.members.set(lobby.code, new Map());
        this.progress.set(lobby.code, new Map());
    }

    async getLobbyByCode(code: LobbyCode): Promise<Lobby | null> {
        return this.lobbies.get(code) ?? null;
    }

    async updateLobby(
        code: LobbyCode,
        updater: (lobby: Lobby) => Lobby,
    ): Promise<Lobby | null> {
        const existing = this.lobbies.get(code);
        if (!existing) return null;

        const updated = updater({ ...existing });
        this.lobbies.set(code, updated);
        return updated;
    }

    async deleteLobby(code: LobbyCode): Promise<void> {
        this.lobbies.delete(code);
        this.members.delete(code);
        this.progress.delete(code);
        this.expiries.delete(code);

        for (const [userId, binding] of this.bindingsByUserId.entries()) {
            if (binding.lobbyCode === code) {
                const updated = { ...binding, lobbyCode: undefined };
                this.bindingsByUserId.set(userId, updated);
                this.bindingsBySocketId.set(updated.socketId, updated);
            }
        }
    }

    async getAllLobbies(): Promise<Lobby[]> {
        return Array.from(this.lobbies.values());
    }

    async bindSocketToUser(binding: UserSessionBinding): Promise<void> {
        const userId = this.key(binding.userId);
        const normalized: UserSessionBinding = { ...binding, userId };

        const oldBinding = this.bindingsByUserId.get(userId);
        if (oldBinding) {
            this.bindingsBySocketId.delete(oldBinding.socketId);
        }

        this.bindingsByUserId.set(userId, normalized);
        this.bindingsBySocketId.set(normalized.socketId, normalized);
    }

    async getUserBinding(userId: string | number): Promise<UserSessionBinding | null> {
        return this.bindingsByUserId.get(this.key(userId)) ?? null;
    }

    async removeUserBindingBySocketId(socketId: string): Promise<void> {
        const binding = this.bindingsBySocketId.get(socketId);
        if (!binding) return;

        this.bindingsBySocketId.delete(socketId);

        const current = this.bindingsByUserId.get(this.key(binding.userId));
        if (current?.socketId === socketId) {
            this.bindingsByUserId.delete(this.key(binding.userId));
        }
    }

    async setMember(code: LobbyCode, member: LobbyMember): Promise<void> {
        const lobbyMembers = this.getMembersMap(code);
        const userId = this.key(member.userId);
        const normalized = { ...member, userId };
        lobbyMembers.set(userId, normalized);

        const binding = this.bindingsByUserId.get(userId);
        if (binding) {
            const updated = { ...binding, lobbyCode: code };
            this.bindingsByUserId.set(userId, updated);
            this.bindingsBySocketId.set(updated.socketId, updated);
        }
    }

    async getMember(code: LobbyCode, userId: string | number): Promise<LobbyMember | null> {
        return this.members.get(code)?.get(this.key(userId)) ?? null;
    }

    async removeMember(code: LobbyCode, userId: string | number): Promise<void> {
        const uid = this.key(userId);
        this.members.get(code)?.delete(uid);
        this.progress.get(code)?.delete(uid);

        const binding = this.bindingsByUserId.get(uid);
        if (binding?.lobbyCode === code) {
            const updated = { ...binding, lobbyCode: undefined };
            this.bindingsByUserId.set(uid, updated);
            this.bindingsBySocketId.set(updated.socketId, updated);
        }
    }

    async listMembers(code: LobbyCode): Promise<LobbyMember[]> {
        return Array.from(this.members.get(code)?.values() ?? []);
    }

    async setMemberProgress(
        code: LobbyCode,
        progress: LobbyMemberProgress,
    ): Promise<void> {
        const lobbyProgress = this.getProgressMap(code);
        const userId = this.key(progress.userId);
        lobbyProgress.set(userId, { ...progress, userId });
    }

    async getMemberProgress(
        code: LobbyCode,
        userId: string | number,
    ): Promise<LobbyMemberProgress | null> {
        return this.progress.get(code)?.get(this.key(userId)) ?? null;
    }

    async listMemberProgress(code: LobbyCode): Promise<LobbyMemberProgress[]> {
        return Array.from(this.progress.get(code)?.values() ?? []);
    }

    async scheduleLobbyExpiry(code: LobbyCode, expiresAt: number): Promise<void> {
        this.expiries.set(code, expiresAt);
    }

    async getLobbyExpiry(code: LobbyCode): Promise<number | null> {
        return this.expiries.get(code) ?? null;
    }

    async clearLobbyExpiry(code: LobbyCode): Promise<void> {
        this.expiries.delete(code);
    }

    async listExpiredLobbyCodes(now: number): Promise<LobbyCode[]> {
        const expiredCodes: LobbyCode[] = [];
        for (const [code, expiresAt] of this.expiries.entries()) {
            if (expiresAt <= now) expiredCodes.push(code);
        }
        return expiredCodes;
    }

    async cleanupExpiredLobbies(now: number): Promise<LobbyCode[]> {
        const expiredCodes = await this.listExpiredLobbyCodes(now);
        for (const code of expiredCodes) {
            await this.deleteLobby(code);
        }
        return expiredCodes;
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }

    async close(): Promise<void> {
        this.lobbies.clear();
        this.members.clear();
        this.progress.clear();
        this.bindingsByUserId.clear();
        this.bindingsBySocketId.clear();
        this.expiries.clear();
    }
}
