import {
    Lobby,
    LobbyCode,
    LobbyMember,
    LobbyMemberProgress,
    UserSessionBinding,
} from '../types/lobby.types';

export interface IStorage {
    createLobby(lobby: Lobby): Promise<void>;
    getLobbyByCode(code: LobbyCode): Promise<Lobby | null>;
    updateLobby(code: LobbyCode, updater: (lobby: Lobby) => Lobby): Promise<Lobby | null>;
    deleteLobby(code: LobbyCode): Promise<void>;
    getAllLobbies(): Promise<Lobby[]>;

    bindSocketToUser(binding: UserSessionBinding): Promise<void>;
    getUserBinding(userId: string | number): Promise<UserSessionBinding | null>;
    removeUserBindingBySocketId(socketId: string): Promise<void>;

    setMember(code: LobbyCode, member: LobbyMember): Promise<void>;
    getMember(code: LobbyCode, userId: string | number): Promise<LobbyMember | null>;

    removeMember(code: LobbyCode, userId: string | number): Promise<void>;
    listMembers(code: LobbyCode): Promise<LobbyMember[]>;

    setMemberProgress(code: LobbyCode, progress: LobbyMemberProgress): Promise<void>;
    getMemberProgress(code: LobbyCode, userId: string | number): Promise<LobbyMemberProgress | null>;
    listMemberProgress(code: LobbyCode): Promise<LobbyMemberProgress[]>;

    scheduleLobbyExpiry(code: LobbyCode, expiresAt: number): Promise<void>;
    getLobbyExpiry(code: LobbyCode): Promise<number | null>;
    clearLobbyExpiry(code: LobbyCode): Promise<void>;
    listExpiredLobbyCodes(now: number): Promise<LobbyCode[]>;
    cleanupExpiredLobbies(now: number): Promise<LobbyCode[]>;

    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
}
