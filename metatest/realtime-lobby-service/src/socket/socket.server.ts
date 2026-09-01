import { Server } from 'socket.io';
import http from 'http';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { socketAuthMiddleware } from './middlewares/auth.middleware';
import { registerLobbyHandlers } from './handlers/lobby.handler';
import { getStorage } from '../storage/storage.factory';

let io: Server;

export function createSocketServer(server: http.Server) {
    io = new Server(server, {
        cors: {
            origin: env.CORS_ORIGINS,
            credentials: true,
        },
        pingTimeout: env.SOCKET_PING_TIMEOUT,
        pingInterval: env.SOCKET_PING_INTERVAL,
    });

    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        logger.info(
            {
                socketId: socket.id,
                userId: socket.data.user.id,
            },
            'Socket connected',
        );

        registerLobbyHandlers(io, socket);

        socket.on('disconnect', async () => {
            logger.info(
                {
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                },
                'Socket disconnected',
            );

            await getStorage().removeUserBindingBySocketId(socket.id);
        });
    });

    startLobbyCleanupJob();

    return io;
}

function startLobbyCleanupJob() {
    const storage = getStorage();

    setInterval(async () => {
        const expired = await storage.cleanupExpiredLobbies(Date.now());

        if (expired.length > 0) {
            logger.info({ expired }, 'Expired lobbies cleaned');
        }
    }, 5000);
}
