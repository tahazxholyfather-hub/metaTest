export type LobbyCode = string;

export type LobbyStatus = 'waiting' | 'starting' | 'started' | 'results' | 'closed';

export interface Lobby {
    code: LobbyCode;
    quizId: number;
    hostUserId: string;
    status: LobbyStatus;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    resultsAt?: number;
    expiresAt?: number;
    questionCount: number;
    maxMembers: number;
    joinLocked: boolean;
    seq: number;
}

export interface LobbyMember {
    userId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;

    firstName?: string | null;
    lastName?: string | null;

    trophies: number;

    isReady: boolean;
    isHost: boolean;
    joinedAt: number;
    connected: boolean;
    socketId?: string;
}

export interface SetReadyPayload {
    code: string;
    isReady: boolean;
}

export interface NotifyLobbyPayload {
    code: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
}

export interface LobbyNotification {
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
}

export interface LobbyMemberProgress {
    userId: string;
    answeredCount: number;
    finished: boolean;
    submittedAt?: number;
    result?: {
        score: number;
        total: number;
        correctCount: number;
        wrongCount: number;
        resultId?: string | number;
        id?: string | number;
    };
}

export interface LobbyState {
    lobby: Lobby;
    members: LobbyMember[];
    progress: LobbyMemberProgress[];
    seq?: number;
    serverNow?: number;
}

export interface UserSessionBinding {
    userId: string;
    socketId: string;
    connectedAt: number;
    lobbyCode?: string;
}

export interface SerializedLobby extends Omit<Lobby, 'quizId'> {
    quizId: string;
}
