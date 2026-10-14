// src/hooks/useLobby.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { isLocalhost, realtimeUrl } from '../runtime';

const SOCKET_URL = realtimeUrl;

export function useLobby(token: string | null) {
    const socketRef = useRef<Socket | null>(null);
    const [lobbyState, setLobbyState] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        // Initialize socket connection with JWT
        socketRef.current = io(SOCKET_URL, {
            auth: { token },
            transports: isLocalhost ? ['websocket', 'polling'] : ['polling'],
            upgrade: isLocalhost,
        });

        const socket = socketRef.current;

        // Listeners
        socket.on('connect', () => console.log('Connected to realtime service'));

        socket.on('lobby_updated', (data) => {
            setLobbyState(data);
            setError(null);
        });

        socket.on('lobby_started', (data) => {
            setLobbyState(data);
            // Trigger redirect to quiz screen here
        });

        socket.on('error', (err) => {
            setError(err.message || 'An error occurred');
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [token]);

    // Actions
    const createLobby = (quizId: string) => {
        socketRef.current?.emit('create_lobby', { quizId });
    };

    const joinLobby = (lobbyId: string) => {
        socketRef.current?.emit('join_lobby', { lobbyId });
    };

    const startLobby = (lobbyId: string) => {
        socketRef.current?.emit('start_lobby', { lobbyId });
    };

    const updateProgress = (lobbyId: string, questionsAnswered: number, isFinished: boolean) => {
        socketRef.current?.emit('update_progress', { lobbyId, questionsAnswered, isFinished });
    };

    return {
        lobbyState,
        error,
        createLobby,
        joinLobby,
        startLobby,
        updateProgress,
    };
}
