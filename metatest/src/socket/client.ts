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
        socketInstance.auth = { token };
        return socketInstance;
    }

    if (socketInstance && options.forceNew) {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
        socketInstance = null;
    }

    // LiteSpeed/OpenLiteSpeed on socket.metatest.app does not proxy WebSocket
    // upgrades. Engine.IO then aborts with "WebSocket is closed before the
    // connection is established". Stay on HTTP long-polling. Do not send
    // extraHeaders — that forces a CORS preflight the proxy also drops.
    socketInstance = io(realtimeUrl, {
        autoConnect: true,
        transports: ['polling'],
        upgrade: false,
        withCredentials: false,
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
    });

    return socketInstance;
}

export function getSocket(): Socket | null {
    return socketInstance;
}

export function connectSocket(token?: string | null): Socket {
    const socket = createSocket({ token });

    if (!socket.connected && !(socket as Socket & { active?: boolean }).active) {
        socket.connect();
    }

    return socket;
}

export function disconnectSocket(): void {
    socketInstance?.disconnect();
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
    socket.auth = { token };

    if (socket.connected) {
        socket.disconnect();
        socket.connect();
    }

    return socket;
}
