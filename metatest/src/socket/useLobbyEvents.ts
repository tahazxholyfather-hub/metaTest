import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { LOBBY_EVENTS } from './events';
import type {
    LobbyErrorEvent,
    LobbyNotification,
    LobbyState,
    MemberProgress,
    QuizResult,
} from './types';

interface UseLobbyEventsParams {
    socket: Socket | null;
    onLobbyState?: (state: LobbyState) => void;
    onLobbyStarted?: (state: any) => void;
    onLobbyStarting?: (state: any) => void;
    onLobbyCancelled?: (payload?: { code?: string; serverNow?: number }) => void;
    onLobbyDestroyed?: (payload: { code: string; reason?: string }) => void;
    onKicked?: (payload: { code: string; userId?: string; reason?: string }) => void;
    onMemberJoined?: (state: LobbyState) => void;
    onMemberLeft?: (state: LobbyState) => void;
    onMemberUpdated?: (state: LobbyState) => void;
    onMemberOnline?: (payload: { code: string; userId: string }) => void;
    onMemberOffline?: (payload: { code: string; userId: string }) => void;
    onMemberProgress?: (payload: MemberProgress | LobbyState) => void;
    onQuizResult?: (payload: QuizResult) => void;
    onLobbyError?: (error: LobbyErrorEvent) => void;
    onNotification?: (payload: LobbyNotification) => void;
}

export function useLobbyEvents({
    socket,
    onLobbyState,
    onLobbyStarted,
    onLobbyStarting,
    onLobbyCancelled,
    onLobbyDestroyed,
    onKicked,
    onMemberJoined,
    onMemberLeft,
    onMemberUpdated,
    onMemberOnline,
    onMemberOffline,
    onMemberProgress,
    onQuizResult,
    onLobbyError,
    onNotification,
}: UseLobbyEventsParams) {
    useEffect(() => {
        if (!socket) {
            return;
        }

        const bindings: Array<[string, (...args: never[]) => void]> = [];

        const bind = (event: string, handler: ((...args: never[]) => void) | undefined) => {
            if (!handler) return;
            socket.on(event, handler);
            bindings.push([event, handler]);
        };

        bind(LOBBY_EVENTS.STATE, onLobbyState as never);
        bind(LOBBY_EVENTS.STARTED, onLobbyStarted as never);
        bind(LOBBY_EVENTS.STARTING, onLobbyStarting as never);
        bind('lobby_starting', onLobbyStarting as never);
        bind(LOBBY_EVENTS.CANCELLED, onLobbyCancelled as never);
        bind('lobby_cancelled', onLobbyCancelled as never);
        bind(LOBBY_EVENTS.DESTROYED, onLobbyDestroyed as never);
        bind(LOBBY_EVENTS.KICKED, onKicked as never);
        bind('lobby:member-kicked', onKicked as never);
        bind(LOBBY_EVENTS.MEMBER_JOINED, onMemberJoined as never);
        bind(LOBBY_EVENTS.MEMBER_LEFT, onMemberLeft as never);
        bind(LOBBY_EVENTS.MEMBER_UPDATED, onMemberUpdated as never);
        bind(LOBBY_EVENTS.MEMBER_ONLINE, onMemberOnline as never);
        bind(LOBBY_EVENTS.MEMBER_OFFLINE, onMemberOffline as never);
        bind(LOBBY_EVENTS.MEMBER_PROGRESS, onMemberProgress as never);
        bind(LOBBY_EVENTS.QUIZ_RESULT, onQuizResult as never);
        bind(LOBBY_EVENTS.ERROR, onLobbyError as never);
        bind(LOBBY_EVENTS.NOTIFICATION, onNotification as never);
        bind('lobby_notification', onNotification as never);

        return () => {
            for (const [event, handler] of bindings) {
                socket.off(event, handler);
            }
        };
    }, [
        socket,
        onLobbyState,
        onLobbyStarted,
        onLobbyStarting,
        onLobbyCancelled,
        onLobbyDestroyed,
        onKicked,
        onMemberJoined,
        onMemberLeft,
        onMemberUpdated,
        onMemberOnline,
        onMemberOffline,
        onMemberProgress,
        onQuizResult,
        onLobbyError,
        onNotification,
    ]);
}
