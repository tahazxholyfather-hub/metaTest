import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './token';

let socketInstance: Socket | null = null;

export interface CreateSocketOptions {
    token?: string | null;
    forceNew?: boolean;
}

function getRealtimeUrl(): string {
    const fromEnv =
        import.meta.env.VITE_REALTIME_URL ||
        import.meta.env.VITE_REALTIME_API_URL;

    if (fromEnv) {
        return String(fromEnv).replace(/\/?$/, '/');
    }

    if (import.meta.env.DEV) {
        return 'http://localhost:4003/';
    }

    return 'https://socket.metatest.app/';
}

export function createSocket(options: CreateSocketOptions = {}): Socket {
    const realtimeUrl = getRealtimeUrl();
    const token = options.token ?? getAccessToken();

    if (!token) {
        throw new Error('Missing access token for realtime connection');
    }

    if (socketInstance && !options.forceNew) {
        return socketInstance;
    }

    socketInstance = io(realtimeUrl, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
        auth: {
            token,
        },
        extraHeaders: {
            Authorization: `Bearer ${token}`,
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 400,
        reconnectionDelayMax: 4000,
        timeout: 8000,
        upgrade: true,
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
