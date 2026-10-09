export const SOCKET_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
    RECONNECT: 'reconnect',
    RECONNECT_ATTEMPT: 'reconnect_attempt',
} as const;

export const LOBBY_EVENTS = {
    CREATE: 'lobby:create',
    JOIN: 'lobby:join',
    REJOIN: 'lobby:rejoin',
    START: 'lobby:start',
    LEAVE: 'lobby:leave',
    KICK: 'lobby:kick',
    DESTROY: 'lobby:destroy',
    SET_READY: 'lobby:set-ready',
    NOTIFY: 'lobby:notify',

    STATE: 'lobby:state',
    STARTED: 'lobby:started',
    STARTING: 'lobby:starting',
    CANCELLED: 'lobby:cancelled',
    DESTROYED: 'lobby:destroyed',
    KICKED: 'lobby:kicked',
    ERROR: 'lobby:error',
    NOTIFICATION: 'lobby:notification',

    MEMBER_JOINED: 'lobby:member_joined',
    MEMBER_LEFT: 'lobby:member_left',
    MEMBER_UPDATED: 'lobby:member_updated',
    MEMBER_ONLINE: 'member:online',
    MEMBER_OFFLINE: 'member:offline',
    MEMBER_PROGRESS: 'member:progress',

    QUIZ_SUBMIT: 'quiz:submit',
    QUIZ_RESULT: 'quiz:result',
} as const;
