import { Server, Socket } from 'socket.io';
import { LobbyEvents } from '../../modules/lobby/events/lobby.events';
import { LobbyService } from '../../modules/lobby/services/lobby.service';
import { logger } from '../../config/logger';

export function registerLobbyHandlers(io: Server, socket: Socket) {
    const lobbyService = new LobbyService(io);

    socket.emit(LobbyEvents.CONNECTION_READY);

    socket.on(LobbyEvents.LOBBY_CREATE, async (payload, cb) => {
        try {
            const result = await lobbyService.createLobby(socket, payload);
            cb?.({ success: true, data: result });
        } catch (err: any) {
            logger.error(err);
            cb?.({ success: false, message: err.message });
        }
    });



    socket.on(LobbyEvents.SET_READY, async (payload, cb) => {
        try {
            await lobbyService.setReady(socket, payload);
            cb?.({ success: true });
        } catch (err: any) {
            logger.error(err);
            cb?.({ success: false, message: err.message });
        }
    });

    socket.on(LobbyEvents.NOTIFY_LOBBY, async (payload) => {
        try {
            await lobbyService.notifyLobby(socket, payload);
        } catch (err: any) {
            logger.error(err);
        }
    });



    socket.on(LobbyEvents.LOBBY_JOIN, async (payload, cb) => {
        try {
            const state = await lobbyService.joinLobby(socket, payload);
            cb?.({ success: true, data: state });
        } catch (err: any) {
            cb?.({ success: false, message: err.message });
        }
    });

    socket.on(LobbyEvents.LOBBY_START, async (payload, cb) => {
        try {
            await lobbyService.startLobby(socket, payload);
            cb?.({ success: true });
        } catch (err: any) {
            cb?.({ success: false, message: err.message });
        }
    });

    socket.on(LobbyEvents.LOBBY_LEAVE, async (payload) => {
        await lobbyService.leaveLobby(socket, payload);
    });

    socket.on(LobbyEvents.LOBBY_KICK, async (payload) => {
        await lobbyService.kickMember(socket, payload);
    });

    socket.on(LobbyEvents.LOBBY_DESTROY, async (payload) => {
        await lobbyService.destroyLobby(socket, payload);
    });

    socket.on(LobbyEvents.MEMBER_PROGRESS, async (payload) => {
        await lobbyService.updateProgress(socket, payload);
    });

    socket.on(LobbyEvents.QUIZ_SUBMIT, async (payload, cb) => {
        try {
            const result = await lobbyService.submitQuiz(socket, payload);
            cb?.({ success: true, data: result });
        } catch (err: any) {
            cb?.({ success: false, message: err.message });
        }
    });
}
