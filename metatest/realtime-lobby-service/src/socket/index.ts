import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware   } from './middlewares/auth.middleware';
import { registerLobbyHandlers } from './handlers/lobby.handler';

export const initializeSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin:'*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.use(socketAuthMiddleware );

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.data.user.username})`);
        registerLobbyHandlers(io, socket);
    });

    return io;
};
