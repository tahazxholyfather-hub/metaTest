"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = socketAuthMiddleware;
const auth_service_1 = require("../../services/auth.service");
const storage_factory_1 = require("../../storage/storage.factory");
const logger_1 = require("../../config/logger");
async function socketAuthMiddleware(socket, next) {
    try {
        const tokenFromAuth = typeof socket.handshake.auth?.token === 'string'
            ? socket.handshake.auth.token
            : undefined;
        const tokenFromHeader = typeof socket.handshake.headers.authorization === 'string'
            ? socket.handshake.headers.authorization
            : undefined;
        const rawToken = tokenFromAuth ?? tokenFromHeader;
        const token = auth_service_1.authService.extractBearerToken(rawToken);
        const user = await auth_service_1.authService.getAuthenticatedUser(token);
        socket.data.user = user;
        socket.data.accessToken = token;
        await (0, storage_factory_1.getStorage)().bindSocketToUser({
            userId: user.id,
            socketId: socket.id,
            connectedAt: Date.now(),
        });
        logger_1.logger.info({
            socketId: socket.id,
            userId: user.id,
            user: user,
        }, 'Socket authenticated');
        next();
    }
    catch (err) {
        logger_1.logger.warn({
            err,
            socketId: socket.id,
        }, 'Socket authentication failed');
        next(new Error('Unauthorized'));
    }
}
