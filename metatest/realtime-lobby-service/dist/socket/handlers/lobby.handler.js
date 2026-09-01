"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLobbyHandlers = registerLobbyHandlers;
const lobby_events_1 = require("../../modules/lobby/events/lobby.events");
const lobby_service_1 = require("../../modules/lobby/services/lobby.service");
const logger_1 = require("../../config/logger");
function registerLobbyHandlers(io, socket) {
    const lobbyService = new lobby_service_1.LobbyService(io);
    socket.emit(lobby_events_1.LobbyEvents.CONNECTION_READY);
    socket.on(lobby_events_1.LobbyEvents.LOBBY_CREATE, async (payload, cb) => {
        try {
            const result = await lobbyService.createLobby(socket, payload);
            cb?.({ success: true, data: result });
        }
        catch (err) {
            logger_1.logger.error(err);
            cb?.({ success: false, message: err.message });
        }
    });
    socket.on(lobby_events_1.LobbyEvents.SET_READY, async (payload, cb) => {
        try {
            await lobbyService.setReady(socket, payload);
            cb?.({ success: true });
        }
        catch (err) {
            logger_1.logger.error(err);
            cb?.({ success: false, message: err.message });
        }
    });
    socket.on(lobby_events_1.LobbyEvents.NOTIFY_LOBBY, async (payload) => {
        try {
            await lobbyService.notifyLobby(socket, payload);
        }
        catch (err) {
            logger_1.logger.error(err);
        }
    });
    socket.on(lobby_events_1.LobbyEvents.LOBBY_JOIN, async (payload, cb) => {
        try {
            const state = await lobbyService.joinLobby(socket, payload);
            cb?.({ success: true, data: state });
        }
        catch (err) {
            cb?.({ success: false, message: err.message });
        }
    });
    socket.on(lobby_events_1.LobbyEvents.LOBBY_START, async (payload, cb) => {
        try {
            await lobbyService.startLobby(socket, payload);
            cb?.({ success: true });
        }
        catch (err) {
            cb?.({ success: false, message: err.message });
        }
    });
    socket.on(lobby_events_1.LobbyEvents.LOBBY_LEAVE, async (payload) => {
        await lobbyService.leaveLobby(socket, payload);
    });
    socket.on(lobby_events_1.LobbyEvents.LOBBY_KICK, async (payload) => {
        await lobbyService.kickMember(socket, payload);
    });
    socket.on(lobby_events_1.LobbyEvents.LOBBY_DESTROY, async (payload) => {
        await lobbyService.destroyLobby(socket, payload);
    });
    socket.on(lobby_events_1.LobbyEvents.MEMBER_PROGRESS, async (payload) => {
        await lobbyService.updateProgress(socket, payload);
    });
    socket.on(lobby_events_1.LobbyEvents.QUIZ_SUBMIT, async (payload, cb) => {
        try {
            const result = await lobbyService.submitQuiz(socket, payload);
            cb?.({ success: true, data: result });
        }
        catch (err) {
            cb?.({ success: false, message: err.message });
        }
    });
}
