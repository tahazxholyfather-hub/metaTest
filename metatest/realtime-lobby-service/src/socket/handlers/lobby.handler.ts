import { Server, Socket } from 'socket.io';
import { ZodType } from 'zod';
import { LobbyEventAliases, LobbyEvents } from '../../modules/lobby/events/lobby.events';
import { getLobbyService } from '../../modules/lobby/services/lobby.service';
import { logger } from '../../config/logger';
import { ackError, ackSuccess, SocketAckFn } from '../ack';
import { allowByEvent } from '../rate-limit';
import {
    createLobbySchema,
    destroyLobbySchema,
    joinLobbySchema,
    kickMemberSchema,
    leaveLobbySchema,
    notifyLobbySchema,
    rejoinLobbySchema,
    setReadySchema,
    startLobbySchema,
    submitQuizSchema,
    updateProgressSchema,
} from '../../modules/lobby/dtos/lobby.schema';
import { CustomError } from '../../core/exceptions/custom-error';

function onValidated<T>(
    socket: Socket,
    events: string[],
    schema: ZodType<T>,
    handler: (payload: T) => Promise<unknown>,
) {
    const listener = async (payload: unknown, cb?: SocketAckFn) => {
        const eventName = events[0];
        if (!allowByEvent(socket.id, eventName)) {
            ackError(
                cb,
                new CustomError('Too many requests', 429, 'RATE_LIMITED'),
            );
            return;
        }

        try {
            const parsed = schema.parse(payload ?? {});
            const data = await handler(parsed);
            ackSuccess(cb, data);
        } catch (err) {
            logger.warn(
                {
                    err,
                    event: eventName,
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                },
                'Lobby event failed',
            );
            ackError(cb, err);
        }
    };

    for (const event of events) {
        socket.on(event, listener);
    }
}

export function registerLobbyHandlers(io: Server, socket: Socket) {
    const lobbyService = getLobbyService(io);

    socket.emit(LobbyEvents.CONNECTION_READY, {
        socketId: socket.id,
        serverNow: Date.now(),
    });

    onValidated(socket, [LobbyEvents.LOBBY_CREATE], createLobbySchema, (payload) =>
        lobbyService.createLobby(socket, payload),
    );

    onValidated(
        socket,
        [LobbyEvents.SET_READY, LobbyEventAliases.SET_READY],
        setReadySchema,
        (payload) => lobbyService.setReady(socket, payload),
    );

    onValidated(
        socket,
        [LobbyEvents.NOTIFY_LOBBY, LobbyEventAliases.NOTIFY],
        notifyLobbySchema,
        (payload) => lobbyService.notifyLobby(socket, payload),
    );

    onValidated(socket, [LobbyEvents.LOBBY_JOIN], joinLobbySchema, (payload) =>
        lobbyService.joinLobby(socket, payload),
    );

    onValidated(
        socket,
        [LobbyEvents.LOBBY_REJOIN, LobbyEventAliases.REJOIN],
        rejoinLobbySchema,
        (payload) => lobbyService.rejoinLobby(socket, payload),
    );

    onValidated(socket, [LobbyEvents.LOBBY_START], startLobbySchema, (payload) =>
        lobbyService.startLobby(socket, payload),
    );

    onValidated(socket, [LobbyEvents.LOBBY_LEAVE], leaveLobbySchema, (payload) =>
        lobbyService.leaveLobby(socket, payload),
    );

    onValidated(socket, [LobbyEvents.LOBBY_KICK], kickMemberSchema, (payload) =>
        lobbyService.kickMember(socket, payload),
    );

    onValidated(socket, [LobbyEvents.LOBBY_DESTROY], destroyLobbySchema, (payload) =>
        lobbyService.destroyLobby(socket, payload),
    );

    onValidated(socket, [LobbyEvents.MEMBER_PROGRESS], updateProgressSchema, (payload) =>
        lobbyService.updateProgress(socket, payload),
    );

    onValidated(socket, [LobbyEvents.QUIZ_SUBMIT], submitQuizSchema, (payload) =>
        lobbyService.submitQuiz(socket, payload),
    );
}
