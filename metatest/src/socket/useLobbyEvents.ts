import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { LOBBY_EVENTS } from './events';
import type {
    LobbyErrorEvent,
    LobbyState,
    MemberProgress,
    QuizResult,
} from './types';

interface UseLobbyEventsParams {
    socket: Socket | null;
    onLobbyState?: (state: LobbyState) => void;
    onLobbyStarted?: (state: LobbyState) => void;
    onLobbyDestroyed?: (payload: { code: string; reason?: string }) => void;
    onKicked?: (payload: { code: string; userId?: string; reason?: string }) => void;
    onMemberJoined?: (state: LobbyState) => void;
    onMemberLeft?: (state: LobbyState) => void;
    onMemberUpdated?: (state: LobbyState) => void;
    onMemberProgress?: (payload: MemberProgress | LobbyState) => void;
    onQuizResult?: (payload: QuizResult) => void;
    onLobbyError?: (error: LobbyErrorEvent) => void;
}

export function useLobbyEvents({
                                   socket,
                                   onLobbyState,
                                   onLobbyStarted,
                                   onLobbyDestroyed,
                                   onKicked,
                                   onMemberJoined,
                                   onMemberLeft,
                                   onMemberUpdated,
                                   onMemberProgress,
                                   onQuizResult,
                                   onLobbyError,
                               }: UseLobbyEventsParams) {
    useEffect(() => {
        if (!socket) {
            return;
        }

        if (onLobbyState) {
            socket.on(LOBBY_EVENTS.STATE, onLobbyState);
        }

        if (onLobbyStarted) {
            socket.on(LOBBY_EVENTS.STARTED, onLobbyStarted);
        }

        if (onLobbyDestroyed) {
            socket.on(LOBBY_EVENTS.DESTROYED, onLobbyDestroyed);
        }

        if (onKicked) {
            socket.on(LOBBY_EVENTS.KICKED, onKicked);
        }

        if (onMemberJoined) {
            socket.on(LOBBY_EVENTS.MEMBER_JOINED, onMemberJoined);
        }

        if (onMemberLeft) {
            socket.on(LOBBY_EVENTS.MEMBER_LEFT, onMemberLeft);
        }

        if (onMemberUpdated) {
            socket.on(LOBBY_EVENTS.MEMBER_UPDATED, onMemberUpdated);
        }

        if (onMemberProgress) {
            socket.on(LOBBY_EVENTS.MEMBER_PROGRESS, onMemberProgress);
        }

        if (onQuizResult) {
            socket.on(LOBBY_EVENTS.QUIZ_RESULT, onQuizResult);
        }

        if (onLobbyError) {
            socket.on(LOBBY_EVENTS.ERROR, onLobbyError);
        }

        return () => {
            if (onLobbyState) {
                socket.off(LOBBY_EVENTS.STATE, onLobbyState);
            }

            if (onLobbyStarted) {
                socket.off(LOBBY_EVENTS.STARTED, onLobbyStarted);
            }

            if (onLobbyDestroyed) {
                socket.off(LOBBY_EVENTS.DESTROYED, onLobbyDestroyed);
            }

            if (onKicked) {
                socket.off(LOBBY_EVENTS.KICKED, onKicked);
            }

            if (onMemberJoined) {
                socket.off(LOBBY_EVENTS.MEMBER_JOINED, onMemberJoined);
            }

            if (onMemberLeft) {
                socket.off(LOBBY_EVENTS.MEMBER_LEFT, onMemberLeft);
            }

            if (onMemberUpdated) {
                socket.off(LOBBY_EVENTS.MEMBER_UPDATED, onMemberUpdated);
            }

            if (onMemberProgress) {
                socket.off(LOBBY_EVENTS.MEMBER_PROGRESS, onMemberProgress);
            }

            if (onQuizResult) {
                socket.off(LOBBY_EVENTS.QUIZ_RESULT, onQuizResult);
            }

            if (onLobbyError) {
                socket.off(LOBBY_EVENTS.ERROR, onLobbyError);
            }
        };
    }, [
        socket,
        onLobbyState,
        onLobbyStarted,
        onLobbyDestroyed,
        onKicked,
        onMemberJoined,
        onMemberLeft,
        onMemberUpdated,
        onMemberProgress,
        onQuizResult,
        onLobbyError,
    ]);
}
