export const LobbyEvents = {
    CONNECTION_READY: 'connection:ready',

    LOBBY_CREATE: 'lobby:create',
    LOBBY_JOIN: 'lobby:join',
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
    LOBBY_MEMBER_KICKED: 'lobby:member-kicked',

    MEMBER_ONLINE: 'member:online',
    MEMBER_OFFLINE: 'member:offline',
    MEMBER_PROGRESS: 'member:progress',
    MEMBER_FINISHED: 'member:finished',

    QUIZ_SUBMIT: 'quiz:submit',
    QUIZ_RESULT: 'quiz:result',
    LOBBY_STARTING:'lobby_starting',   // countdown started, grace window open
    LOBBY_CANCELLED:'lobby_cancelled', // countdown cancelled (host disconnected)
    SET_READY: 'set_ready',
    NOTIFY_LOBBY: 'notify_lobby'

} as const;
