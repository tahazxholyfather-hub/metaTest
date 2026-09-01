"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = createSocketServer;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const lobby_handler_1 = require("./handlers/lobby.handler");
const storage_factory_1 = require("../storage/storage.factory");
let io;
function createSocketServer(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: env_1.env.CORS_ORIGINS,
            credentials: true,
        },
        pingTimeout: env_1.env.SOCKET_PING_TIMEOUT,
        pingInterval: env_1.env.SOCKET_PING_INTERVAL,
    });
    io.use(auth_middleware_1.socketAuthMiddleware);
    io.on('connection', (socket) => {
        logger_1.logger.info({
            socketId: socket.id,
            userId: socket.data.user.id,
        }, 'Socket connected');
        (0, lobby_handler_1.registerLobbyHandlers)(io, socket);
        socket.on('disconnect', async () => {
            logger_1.logger.info({
                socketId: socket.id,
                userId: socket.data.user?.id,
            }, 'Socket disconnected');
            await (0, storage_factory_1.getStorage)().removeUserBindingBySocketId(socket.id);
        });
    });
    startLobbyCleanupJob();
    return io;
}
function startLobbyCleanupJob() {
    const storage = (0, storage_factory_1.getStorage)();
    setInterval(async () => {
        const expired = await storage.cleanupExpiredLobbies(Date.now());
        if (expired.length > 0) {
            logger_1.logger.info({ expired }, 'Expired lobbies cleaned');
        }
    }, 5000);
}
