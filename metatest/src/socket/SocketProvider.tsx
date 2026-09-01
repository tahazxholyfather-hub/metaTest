//SocketProvider.tsx
import {
    createContext,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, destroySocket } from './client';
import { getAccessToken } from './token';
import { SOCKET_EVENTS } from './events';

export type SocketConnectionStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error';

export interface SocketContextValue {
    socket: Socket | null;
    status: SocketConnectionStatus;
    isConnected: boolean;
    error: string | null;
    connect: (token?: string | null) => Socket | null;
    disconnect: () => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
    children: ReactNode;
    autoConnect?: boolean;
}

function getErrorMessage(err: unknown, fallback: string): string {
    if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
    ) {
        return (err as { message: string }).message;
    }

    return fallback;
}

export function SocketProvider({
                                   children,
                                   autoConnect = true,
                               }: SocketProviderProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [status, setStatus] = useState<SocketConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback((token?: string | null) => {
        const accessToken = token ?? getAccessToken();

        if (!accessToken) {
            setStatus('error');
            setError('Missing access token');
            return null;
        }

        try {
            setStatus('connecting');
            setError(null);

            const nextSocket = connectSocket(accessToken);

            setSocket(nextSocket);

            return nextSocket;
        } catch (err: unknown) {
            const message = getErrorMessage(err, 'Failed to connect socket');

            setStatus('error');
            setError(message);

            return null;
        }
    }, []);

    const disconnect = useCallback(() => {
        destroySocket();
        setSocket(null);
        setStatus('disconnected');
        setError(null);
    }, []);

    useEffect(() => {
        if (!autoConnect) {
            return;
        }

        const accessToken = getAccessToken();

        if (!accessToken) {
            return;
        }

        connect(accessToken);
    }, [autoConnect, connect]);

    useEffect(() => {
        if (!socket) {
            return;
        }

        const handleConnect = () => {
            setStatus('connected');
            setError(null);
        };

        const handleDisconnect = (reason: string) => {
            setStatus('disconnected');

            if (reason === 'io server disconnect') {
                socket.connect();
            }
        };

        const handleConnectError = (err: unknown) => {
            const message = getErrorMessage(err, 'Socket connection error');

            setStatus('error');
            setError(message);
        };

        const handleReconnectAttempt = () => {
            setStatus('connecting');
        };

        const handleReconnect = () => {
            setStatus('connected');
            setError(null);
        };

        socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
        socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
        socket.on(SOCKET_EVENTS.CONNECT_ERROR, handleConnectError);

        socket.io.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, handleReconnectAttempt);
        socket.io.on(SOCKET_EVENTS.RECONNECT, handleReconnect);

        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
            socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
            socket.off(SOCKET_EVENTS.CONNECT_ERROR, handleConnectError);

            socket.io.off(SOCKET_EVENTS.RECONNECT_ATTEMPT, handleReconnectAttempt);
            socket.io.off(SOCKET_EVENTS.RECONNECT, handleReconnect);
        };
    }, [socket]);

    useEffect(() => {
        return () => {
            destroySocket();
        };
    }, []);

    const value = useMemo<SocketContextValue>(
        () => ({
            socket,
            status,
            isConnected: status === 'connected',
            error,
            connect,
            disconnect,
        }),
        [socket, status, error, connect, disconnect],
    );

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}
