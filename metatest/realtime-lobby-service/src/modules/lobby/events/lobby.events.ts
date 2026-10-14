export const LobbyEvents = {
    CONNECTION_READY: 'connection:ready',

    LOBBY_CREATE: 'lobby:create',
    LOBBY_JOIN: 'lobby:join',
    LOBBY_REJOIN: 'lobby:rejoin',
    LOBBY_LEAVE: 'lobby:leave',
    LOBBY_START: 'lobby:start',
    LOBBY_DESTROY: 'lobby:destroy',
    LOBBY_KICK: 'lobby:kick',
    LOBBY_STATE: 'lobby:state',
    LOBBY_ERROR: 'lobby:error',
    LOBBY_JOINED: 'lobby:joined',
    LOBBY_LEFT: 'lobby:left',
    LOBBY_STARTED: 'lobby:started',
    LOBBY_DESTROYED: 'lobby:destroyed',
    LOBBY_KICKED: 'lobby:kicked',
    LOBBY_STARTING: 'lobby:starting',
    LOBBY_CANCELLED: 'lobby:cancelled',

    MEMBER_ONLINE: 'member:online',
    MEMBER_OFFLINE: 'member:offline',
    MEMBER_PROGRESS: 'member:progress',
    MEMBER_FINISHED: 'member:finished',

    QUIZ_SUBMIT: 'quiz:submit',
    QUIZ_RESULT: 'quiz:result',

    SET_READY: 'lobby:set-ready',
    NOTIFY_LOBBY: 'lobby:notify',
    NOTIFICATION: 'lobby:notification',
} as const;

export const LobbyEventAliases = {
    REJOIN: 'rejoin_lobby',
    SET_READY: 'set_ready',
    NOTIFY: 'notify_lobby',
    STARTING: 'lobby_starting',
    CANCELLED: 'lobby_cancelled',
    KICKED: 'lobby:member-kicked',
    NOTIFICATION: 'lobby_notification',
} as const;
