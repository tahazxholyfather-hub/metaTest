import { Socket } from 'socket.io-client';
import { LOBBY_EVENTS } from './events';
import type {
    CreateLobbyPayload,
    DestroyLobbyPayload,
    JoinLobbyPayload,
    KickMemberPayload,
    LeaveLobbyPayload,
    LobbyState,
    QuizResult,
    SocketAck,
    StartLobbyPayload,
    SubmitQuizPayload,
    UpdateProgressPayload,
} from './types';

const DEFAULT_ACK_TIMEOUT_MS = 10000;

export class SocketRequestError extends Error {
    public readonly code?: string;
    public readonly statusCode?: number;
    public readonly details?: unknown;

    constructor(params: {
        message: string;
        code?: string;
        statusCode?: number;
        details?: unknown;
    }) {
        super(params.message);
        this.name = 'SocketRequestError';
        this.code = params.code;
        this.statusCode = params.statusCode;
        this.details = params.details;
    }
}

function ensureSocketReady(socket: Socket | null): asserts socket is Socket {
    if (!socket) {
        throw new SocketRequestError({
            message: 'Socket is not initialized',
            code: 'SOCKET_NOT_INITIALIZED',
        });
    }

    if (!socket.connected) {
        throw new SocketRequestError({
            message: 'Socket is not connected',
            code: 'SOCKET_NOT_CONNECTED',
        });
    }
}

type UnknownSocketAckError = {
    message?: unknown;
    code?: unknown;
    statusCode?: unknown;
    details?: unknown;
};

type UnknownSocketAck<TResponse> = SocketAck<TResponse> & {
    message?: unknown;
    code?: unknown;
    statusCode?: unknown;
    details?: unknown;
    error?: UnknownSocketAckError;
};

function createSocketRequestErrorFromAck<TResponse>(
    event: string,
    response: UnknownSocketAck<TResponse>,
): SocketRequestError {
    const error = response.error;

    const message =
        typeof error?.message === 'string'
            ? error.message
            : typeof response.message === 'string'
                ? response.message
                : `Socket request failed: ${event}`;

    const code =
        typeof error?.code === 'string'
            ? error.code
            : typeof response.code === 'string'
                ? response.code
                : 'SOCKET_REQUEST_FAILED';

    const statusCode =
        typeof error?.statusCode === 'number'
            ? error.statusCode
            : typeof response.statusCode === 'number'
                ? response.statusCode
                : undefined;


    return new SocketRequestError({
        message,
        code,
        statusCode,
        details: error?.details ?? response.details ?? response,
    });
}

function emitWithAck<TResponse, TPayload = unknown>(
    socket: Socket,
    event: string,
    payload?: TPayload,
    timeoutMs = DEFAULT_ACK_TIMEOUT_MS,
): Promise<TResponse> {
    ensureSocketReady(socket);

    return new Promise<TResponse>((resolve, reject) => {
        socket.timeout(timeoutMs).emit(
            event,
            payload,
            (timeoutError: Error | null, response?: SocketAck<TResponse>) => {
                if (timeoutError) {
                    reject(
                        new SocketRequestError({
                            message: `Socket request timed out: ${event}`,
                            code: 'SOCKET_ACK_TIMEOUT',
                        }),
                    );
                    return;
                }

                if (!response) {
                    reject(
                        new SocketRequestError({
                            message: `Empty socket response: ${event}`,
                            code: 'EMPTY_SOCKET_RESPONSE',
                        }),
                    );
                    return;
                }

                const normalizedResponse = response as SocketAck<TResponse> & {
                    success?: boolean;
                    message?: string;
                    code?: string;
                    statusCode?: number;
                    details?: unknown;
                };

                const isSuccess =
                    normalizedResponse.ok === true ||
                    normalizedResponse.success === true;

                if (!isSuccess) {
                    console.error('[socket ack failed]', event, response);

                    reject(
                        createSocketRequestErrorFromAck(
                            event,
                            normalizedResponse as UnknownSocketAck<TResponse>,
                        ),
                    );
                    return;
                }

                resolve(normalizedResponse.data);
            },
        );
    });
}


export function createLobby(
    socket: Socket | null,
    payload: CreateLobbyPayload,
): Promise<LobbyState> {
    ensureSocketReady(socket);

    return emitWithAck<LobbyState, CreateLobbyPayload>(
        socket,
        LOBBY_EVENTS.CREATE,
        payload,
    );
}

export function joinLobby(
    socket: Socket | null,
    payload: JoinLobbyPayload,
): Promise<LobbyState> {
    ensureSocketReady(socket);

    return emitWithAck<LobbyState, JoinLobbyPayload>(
        socket,
        LOBBY_EVENTS.JOIN,
        {
            ...payload,
            code: payload.code.trim(),
        },
    );
}

export function startLobby(
    socket: Socket | null,
    payload: StartLobbyPayload,
): Promise<LobbyState> {
    ensureSocketReady(socket);

    return emitWithAck<LobbyState, StartLobbyPayload>(
        socket,
        LOBBY_EVENTS.START,
        {
            ...payload,
            code: payload.code.trim(),
        },
    );
}

export const rejoinLobby = (
    socket: Socket,
    payload: { code: string }
): Promise<{ ok: boolean; reason?: string; state?: LobbyState }> => {
    return new Promise((resolve) => {
        socket.emit('rejoin_lobby', payload, (response: any) => {
            resolve(response);
        });
    });
};

export function leaveLobby(
    socket: Socket | null,
    payload: LeaveLobbyPayload,
): Promise<{ code: string }> {
    ensureSocketReady(socket);

    return emitWithAck<{ code: string }, LeaveLobbyPayload>(
        socket,
        LOBBY_EVENTS.LEAVE,
        {
            ...payload,
            code: payload.code.trim(),
        },
    );
}

export function kickMember(
    socket: Socket | null,
    payload: KickMemberPayload,
): Promise<LobbyState> {
    ensureSocketReady(socket);

    return emitWithAck<LobbyState, KickMemberPayload>(
        socket,
        LOBBY_EVENTS.KICK,
        {
            ...payload,
            code: payload.code.trim(),
        },
    );
}

export function destroyLobby(
    socket: Socket | null,
    payload: DestroyLobbyPayload,
): Promise<{ code: string }> {
    ensureSocketReady(socket);

    return emitWithAck<{ code: string }, DestroyLobbyPayload>(
        socket,
        LOBBY_EVENTS.DESTROY,
        {
            ...payload,
            code: payload.code.trim(),
        },
    );
}

export function updateMemberProgress(
    socket: Socket | null,
    payload: UpdateProgressPayload,
): Promise<LobbyState> {
    ensureSocketReady(socket);

    return emitWithAck<LobbyState, UpdateProgressPayload>(
        socket,
        LOBBY_EVENTS.MEMBER_PROGRESS,
        {
            ...payload,
            code: payload.code.trim(),
        },
    );
}

export function submitQuiz(
    socket: Socket | null,
    payload: SubmitQuizPayload,
): Promise<QuizResult> {
    ensureSocketReady(socket);

    return emitWithAck<QuizResult, SubmitQuizPayload>(
        socket,
        LOBBY_EVENTS.QUIZ_SUBMIT,
        {
            ...payload,
            code: payload.code.trim(),
        },
        30000,
    );
}
