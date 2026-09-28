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
        import.meta.env.VITE_REALTIME_API_URL ||
        'https://socket.metatest.app';

    return String(fromEnv).replace(/\/+$/, '');
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

    // Do not set extraHeaders in the browser. Authorization there forces an
    // OPTIONS preflight that LiteSpeed/nginx often answers without CORS.
    // Socket.IO already sends the JWT in handshake.auth.token.
    socketInstance = io(realtimeUrl, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: {
            token,
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 400,
        reconnectionDelayMax: 4000,
        timeout: 8000,
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

    if (socket.connected) {
        socket.disconnect();
    }

    socket.connect();

    return socket;
}
