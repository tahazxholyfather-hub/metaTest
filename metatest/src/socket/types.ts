
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
    questionCount?: number;
    seq?: number;
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
    connected?: boolean;
    ready?: boolean;
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
    lobbyCode?: LobbyCode;
    userId: string;
    answeredCount: number;
    totalQuestions?: number;
    finished: boolean;
    submitted?: boolean;
    score?: number | null;
    maxScore?: number | null;
    percentage?: number | null;
    resultId?: string | null;
    updatedAt?: string;
    finishedAt?: string | null;
    submittedAt?: number;
    serverNow?: number;
}

export interface LobbyState {
    code: string | Partial<Path> | number;
    lobby: Lobby;
    members: LobbyMember[];
    progress: MemberProgress[];
    currentUserId?: string;
    seq?: number;
    serverNow?: number;
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
    targetUserId: string;
    userId?: string;
}

export interface SetReadyRequestPayload {
    code: string;
    isReady: boolean;
}

export interface RejoinLobbyPayload {
    code: string;
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
    quizId?: string | number;
    userId?: string | number;
    answers: Record<string, number> | unknown[];
    questionIds?: number[];
    timeSpent?: number;
    questionTimes?: Record<string, number>;
    selectionLog?: Array<{
        questionId: number;
        optionId: number;
        timeSpentMs: number;
        timestamp: number;
    }>;
}

export interface QuizResult {
    userId?: string;
    lobbyCode?: string;
    score: number;
    total?: number;
    correctCount?: number;
    wrongCount?: number;
    maxScore?: number;
    percentage?: number;
    resultId?: string | number | null;
    id?: string | number | null;
    details?: unknown;
}

export interface LobbyErrorEvent {
    message: string;
    code?: string;
    statusCode?: number;
    details?: unknown;
}
