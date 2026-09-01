//clients.ts
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './token';

let socketInstance: Socket | null = null;

export interface CreateSocketOptions {
    token?: string | null;
    forceNew?: boolean;
}

export function createSocket(options: CreateSocketOptions = {}): Socket {
    const realtimeUrl = 'https://socket.metatest.app/';

    if (!realtimeUrl) {
        throw new Error('Missing VITE_REALTIME_URL environment variable');
    }

    const token = options.token ?? getAccessToken();

    if (!token) {
        throw new Error('Missing access token for realtime connection');
    }

    if (socketInstance && !options.forceNew) {
        return socketInstance;
    }

    socketInstance = io(realtimeUrl, {
        autoConnect: true,
        transports: ['polling'],
        auth: {
            token,
        },
        extraHeaders: {
            Authorization: `Bearer ${token}`,
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 10000,
    });

    return socketInstance;
}

export function getSocket(): Socket | null {
    return socketInstance;
}

export function connectSocket(token?: string | null): Socket {
    const socket = createSocket({ token });

    if (!socket.connected) {
        socket.connect();
    }

    return socket;
}

export function disconnectSocket(): void {
    if (!socketInstance) {
        return;
    }

    socketInstance.disconnect();
}

export function destroySocket(): void {
    if (!socketInstance) {
        return;
    }

    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
}

export function refreshSocketAuthToken(token: string): Socket {
    const socket = createSocket();

    socket.auth = {
        token,
    };

    socket.io.opts.extraHeaders = {
        Authorization: `Bearer ${token}`,
    };

    if (socket.connected) {
        socket.disconnect();
    }

    socket.connect();

    return socket;
}
