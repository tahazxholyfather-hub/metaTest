"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
class MemoryStore {
    lobbies = new Map();
    members = new Map();
    progress = new Map();
    bindingsByUserId = new Map();
    bindingsBySocketId = new Map();
    expiries = new Map();
    key(userId) {
        return String(userId);
    }
    getMembersMap(code) {
        let map = this.members.get(code);
        if (!map) {
            map = new Map();
            this.members.set(code, map);
        }
        return map;
    }
    getProgressMap(code) {
        let map = this.progress.get(code);
        if (!map) {
            map = new Map();
            this.progress.set(code, map);
        }
        return map;
    }
    async createLobby(lobby) {
        this.lobbies.set(lobby.code, lobby);
        this.members.set(lobby.code, new Map());
        this.progress.set(lobby.code, new Map());
    }
    async getLobbyByCode(code) {
        return this.lobbies.get(code) ?? null;
    }
    async updateLobby(code, updater) {
        const existing = this.lobbies.get(code);
        if (!existing)
            return null;
        const updated = updater({ ...existing });
        this.lobbies.set(code, updated);
        return updated;
    }
    async deleteLobby(code) {
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
    async getAllLobbies() {
        return Array.from(this.lobbies.values());
    }
    async bindSocketToUser(binding) {
        const oldBinding = this.bindingsByUserId.get(binding.userId);
        if (oldBinding) {
            this.bindingsBySocketId.delete(oldBinding.socketId);
        }
        this.bindingsByUserId.set(binding.userId, binding);
        this.bindingsBySocketId.set(binding.socketId, binding);
    }
    async getUserBinding(userId) {
        return this.bindingsByUserId.get(this.key(userId)) ?? null;
    }
    async removeUserBindingBySocketId(socketId) {
        const binding = this.bindingsBySocketId.get(socketId);
        if (!binding)
            return;
        this.bindingsBySocketId.delete(socketId);
        const current = this.bindingsByUserId.get(binding.userId);
        if (current?.socketId === socketId) {
            this.bindingsByUserId.delete(binding.userId);
        }
    }
    async setMember(code, member) {
        const lobbyMembers = this.getMembersMap(code);
        lobbyMembers.set(this.key(member.userId), member);
        const binding = this.bindingsByUserId.get(this.key(member.userId));
        if (binding) {
            const updated = { ...binding, lobbyCode: code };
            this.bindingsByUserId.set(binding.userId, updated);
            this.bindingsBySocketId.set(binding.socketId, updated);
        }
    }
    async getMember(code, userId) {
        return this.members.get(code)?.get(this.key(userId)) ?? null;
    }
    async removeMember(code, userId) {
        this.members.get(code)?.delete(this.key(userId));
        this.progress.get(code)?.delete(this.key(userId));
        const binding = this.bindingsByUserId.get(this.key(userId));
        if (binding?.lobbyCode === code) {
            const updated = { ...binding, lobbyCode: undefined };
            this.bindingsByUserId.set(binding.userId, updated);
            this.bindingsBySocketId.set(binding.socketId, updated);
        }
    }
    async listMembers(code) {
        return Array.from(this.members.get(code)?.values() ?? []);
    }
    async setMemberProgress(code, progress) {
        const lobbyProgress = this.getProgressMap(code);
        lobbyProgress.set(this.key(progress.userId), progress);
    }
    async getMemberProgress(code, userId) {
        return this.progress.get(code)?.get(this.key(userId)) ?? null;
    }
    async listMemberProgress(code) {
        return Array.from(this.progress.get(code)?.values() ?? []);
    }
    async scheduleLobbyExpiry(code, expiresAt) {
        this.expiries.set(code, expiresAt);
    }
    async getLobbyExpiry(code) {
        return this.expiries.get(code) ?? null;
    }
    async clearLobbyExpiry(code) {
        this.expiries.delete(code);
    }
    async cleanupExpiredLobbies(now) {
        const expiredCodes = [];
        for (const [code, expiresAt] of this.expiries.entries()) {
            if (expiresAt <= now)
                expiredCodes.push(code);
        }
        for (const code of expiredCodes) {
            await this.deleteLobby(code);
        }
        return expiredCodes;
    }
}
exports.MemoryStore = MemoryStore;
