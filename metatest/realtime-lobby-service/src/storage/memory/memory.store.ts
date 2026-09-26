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
        this.lobbies.set(lobby.code, lobby);
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
        const oldBinding = this.bindingsByUserId.get(binding.userId);

        if (oldBinding) {
            this.bindingsBySocketId.delete(oldBinding.socketId);
        }

        this.bindingsByUserId.set(binding.userId, binding);
        this.bindingsBySocketId.set(binding.socketId, binding);
    }

    async getUserBinding(userId: string | number): Promise<UserSessionBinding | null> {
        return this.bindingsByUserId.get(this.key(userId)) ?? null;
    }

    async removeUserBindingBySocketId(socketId: string): Promise<void> {
        const binding = this.bindingsBySocketId.get(socketId);
        if (!binding) return;

        this.bindingsBySocketId.delete(socketId);

        const current = this.bindingsByUserId.get(binding.userId);
        if (current?.socketId === socketId) {
            this.bindingsByUserId.delete(binding.userId);
        }
    }

    async setMember(code: LobbyCode, member: LobbyMember): Promise<void> {
        const lobbyMembers = this.getMembersMap(code);
        lobbyMembers.set(this.key(member.userId), member);

        const binding = this.bindingsByUserId.get(this.key(member.userId));
        if (binding) {
            const updated = { ...binding, lobbyCode: code };
            this.bindingsByUserId.set(binding.userId, updated);
            this.bindingsBySocketId.set(binding.socketId, updated);
        }
    }

    async getMember(code: LobbyCode, userId: string | number): Promise<LobbyMember | null> {
        return this.members.get(code)?.get(this.key(userId)) ?? null;
    }

    async removeMember(code: LobbyCode, userId: string | number): Promise<void> {
        this.members.get(code)?.delete(this.key(userId));
        this.progress.get(code)?.delete(this.key(userId));

        const binding = this.bindingsByUserId.get(this.key(userId));
        if (binding?.lobbyCode === code) {
            const updated = { ...binding, lobbyCode: undefined };
            this.bindingsByUserId.set(binding.userId, updated);
            this.bindingsBySocketId.set(binding.socketId, updated);
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
        lobbyProgress.set(this.key(progress.userId), progress);
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
}
