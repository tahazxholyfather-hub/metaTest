import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import http from 'http';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { socketAuthMiddleware } from './middlewares/auth.middleware';
import { registerLobbyHandlers } from './handlers/lobby.handler';
import { closeStorage, getStorage } from '../storage/storage.factory';
import { getLobbyService } from '../modules/lobby/services/lobby.service';
import {
    closeSocketResources,
    registerAdapterClient,
    setIO,
} from './io.registry';
import { clearSocketRateLimit } from './rate-limit';

let cleanupTimer: NodeJS.Timeout | null = null;

export function createSocketServer(server: http.Server) {
    getStorage();

    const io = new Server(server, {
        cors: {
            origin: env.CORS_ORIGINS,
            credentials: true,
        },
        pingTimeout: env.SOCKET_PING_TIMEOUT,
        pingInterval: env.SOCKET_PING_INTERVAL,
        maxHttpBufferSize: 512 * 1024,
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: false,
        },
        transports: ['websocket', 'polling'],
    });

    if (env.STORAGE_DRIVER === 'redis') {
        const pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
        const subClient = pubClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        registerAdapterClient(pubClient);
        registerAdapterClient(subClient);
        logger.info('Socket.IO Redis adapter enabled');
    }

    setIO(io);
    const lobbyService = getLobbyService(io);

    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        logger.info(
            {
                socketId: socket.id,
                userId: socket.data.user?.id,
            },
            'Socket connected',
        );

        registerLobbyHandlers(io, socket);

        socket.on('disconnect', (reason) => {
            logger.info(
                {
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                    reason,
                },
                'Socket disconnected',
            );

            void (async () => {
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

                clearSocketRateLimit(socket.id);
            })();
        });
    });

    startLobbyCleanupJob(lobbyService);

    return io;
}

function startLobbyCleanupJob(lobbyService: ReturnType<typeof getLobbyService>) {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
    }

    cleanupTimer = setInterval(() => {
        void lobbyService.sweepExpiredLobbies().catch((err) => {
            logger.warn({ err }, 'Lobby expiry sweep failed');
        });
    }, 5000);

    cleanupTimer.unref?.();
}

export async function shutdownSocketServer(): Promise<void> {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }

    await closeSocketResources();
    await closeStorage();
}
