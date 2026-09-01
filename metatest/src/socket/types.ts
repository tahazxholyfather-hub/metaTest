
//types.ts
import type { Path } from 'react-router-dom';


export type LobbyStatus = 'waiting' | 'starting' | 'started' | 'results' | 'closed';

export type MemberRole = 'host' | 'player';

export type OnlineState = 'online' | 'offline';

export type LobbyCode = string;

export interface AuthenticatedSocketUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
}

export interface Lobby {
    id: string;
    code: LobbyCode;
    quizId: string;
    quizTitle?: string;
    quizDescription?: string | null;
    quizQuestionCount?: number;
    hostUserId: string;
    status: LobbyStatus;
    maxMembers: number;
    createdAt: string;
    startedAt?: number | string;
    resultsAt?: string | null;
    expiresAt?: string | null;
}

export interface LobbyMember {
    lobbyCode: LobbyCode;
    userId: string;
    username: string;
    displayName: string;
    socketId: string;
    trophies: number;
    avatarUrl?: string | null;
    role: MemberRole;
    onlineState: OnlineState;
    joinedAt: string;
    isReady: boolean;
    disconnectedAt?: string | null;
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



export interface MemberProgress {
    lobbyCode: LobbyCode;
    userId: string;
    answeredCount: number;
    totalQuestions?: number;
    finished: boolean;
    submitted: boolean;
    score?: number | null;
    maxScore?: number | null;
    percentage?: number | null;
    resultId?: string | null;
    updatedAt: string;
    finishedAt?: string | null;
}

export interface LobbyState {
    code: string | Partial<Path> | number;
    lobby: Lobby;
    members: LobbyMember[];
    progress: MemberProgress[];
    currentUserId?: string;
}

export interface SocketAckSuccess<T> {
    ok: true;
    data: T;
}

export interface SocketAckFailure {
    ok: false;
    error: {
        message: string;
        code?: string;
        statusCode?: number;
        details?: unknown;
    };
}

export type SocketAck<T> = SocketAckSuccess<T> | SocketAckFailure;

export interface CreateLobbyPayload {
    quizId: string;
    maxMembers?: number;
    code?: string;
}

export interface JoinLobbyPayload {
    code: string;
}

export interface StartLobbyPayload {
    code: string;
}

export interface LeaveLobbyPayload {
    code: string;
}

export interface KickMemberPayload {
    code: string;
    userId: string;
}

export interface DestroyLobbyPayload {
    code: string;
}

export interface UpdateProgressPayload {
    code: string;
    answeredCount: number;
    totalQuestions?: number;
    finished?: boolean;
}

export interface SubmitQuizPayload {
    code: string;
    quizId: string | number;
    answers: unknown[];
}

export interface QuizResult {
    userId: string;
    lobbyCode: string;
    score: number;
    maxScore: number;
    percentage: number;
    resultId?: string | null;
    details?: unknown;
}

export interface LobbyErrorEvent {
    message: string;
    code?: string;
    statusCode?: number;
    details?: unknown;
}
