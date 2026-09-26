import { Server } from 'socket.io';
import http from 'http';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { socketAuthMiddleware } from './middlewares/auth.middleware';
import { registerLobbyHandlers } from './handlers/lobby.handler';
import { getStorage } from '../storage/storage.factory';
import { getLobbyService } from '../modules/lobby/services/lobby.service';

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

    const lobbyService = getLobbyService(io);

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

        socket.on('disconnect', async (reason) => {
            logger.info(
                {
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                    reason,
                },
                'Socket disconnected',
            );

            try {
                await lobbyService.handleDisconnect(socket);
            } catch (err) {
                logger.warn({ err, socketId: socket.id }, 'Disconnect handler failed');
            }

            try {
                await getStorage().removeUserBindingBySocketId(socket.id);
            } catch (err) {
                logger.warn({ err, socketId: socket.id }, 'Failed to unbind socket');
            }
        });
    });

    startLobbyCleanupJob(lobbyService);

    return io;
}

function startLobbyCleanupJob(lobbyService: ReturnType<typeof getLobbyService>) {
    const timer = setInterval(() => {
        void lobbyService.sweepExpiredLobbies().catch((err) => {
            logger.warn({ err }, 'Lobby expiry sweep failed');
        });
    }, 5000);
    timer.unref?.();
}
