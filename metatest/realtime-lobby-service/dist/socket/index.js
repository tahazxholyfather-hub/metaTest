"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const lobby_handler_1 = require("./handlers/lobby.handler");
const initializeSocket = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    io.use(auth_middleware_1.socketAuthMiddleware);
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.data.user.username})`);
        (0, lobby_handler_1.registerLobbyHandlers)(io, socket);
    });
    return io;
};
exports.initializeSocket = initializeSocket;
