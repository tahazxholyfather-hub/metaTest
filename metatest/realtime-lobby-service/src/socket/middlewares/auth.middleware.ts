import { Socket } from 'socket.io';
type ExtendedError = Error;
import { authService } from '../../services/auth.service';
import { AuthenticatedUser } from '../../core/types/user.types';
import { getStorage } from '../../storage/storage.factory';
import { logger } from '../../config/logger';
import { getIO } from '../io.registry';

export interface AuthenticatedSocket extends Socket {
    data: {
        user: AuthenticatedUser;
        accessToken: string;
    };
}

export async function socketAuthMiddleware(
    socket: Socket,
    next: (err?: ExtendedError) => void,
) {
    try {
        const tokenFromAuth =
            typeof socket.handshake.auth?.token === 'string'
                ? socket.handshake.auth.token
                : undefined;

        const tokenFromHeader =
            typeof socket.handshake.headers.authorization === 'string'
                ? socket.handshake.headers.authorization
                : undefined;

        const rawToken = tokenFromAuth ?? tokenFromHeader;
        const token = authService.extractBearerToken(rawToken);
        const user = await authService.getAuthenticatedUser(token);

        socket.data.user = user;
        socket.data.accessToken = token;

        const storage = getStorage();
        const previous = await storage.getUserBinding(user.id);

        await storage.bindSocketToUser({
            userId: user.id,
            socketId: socket.id,
            connectedAt: Date.now(),
            lobbyCode: previous?.lobbyCode,
        });

        if (previous?.socketId && previous.socketId !== socket.id) {
            const previousSocket = getIO()?.sockets.sockets.get(previous.socketId);
            if (previousSocket) {
                previousSocket.emit('lobby:error', {
                    message: 'Session replaced',
                    code: 'SESSION_REPLACED',
                });
                previousSocket.disconnect(true);
            }
        }

        logger.info(
            {
                socketId: socket.id,
                userId: user.id,
            },
            'Socket authenticated',
        );

        next();
    } catch (err) {
        logger.warn(
            {
                socketId: socket.id,
            },
            'Socket authentication failed',
        );

        next(new Error('Unauthorized'));
    }
}
