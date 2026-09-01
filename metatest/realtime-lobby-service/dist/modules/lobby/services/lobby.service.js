"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyService = void 0;
const env_1 = require("../../../config/env");
const storage_factory_1 = require("../../../storage/storage.factory");
const main_backend_service_1 = require("../../../services/main-backend.service");
const lobby_events_1 = require("../events/lobby.events");
const custom_error_1 = require("../../../core/exceptions/custom-error");
const hash_1 = require("../../../../../src/backend/utils/hash");
const COUNTDOWN_MS = 3000;
const EMPTY_LOBBY_TTL_MS = 60_000;
// ─── In-process mutex map ──────────────────────────────────────────────────────
// Prevents TOCTOU races on join/start/submit when multiple sockets hit the
// same lobby concurrently.  Key = lobby code (or "code:userId" for per-user
// critical sections).
//
// NOTE: This is in-process only. If you scale to multiple Node processes /
// socket.io nodes behind a load balancer, replace with a distributed lock
// (e.g. Redlock / Redis SET NX PX).
const _locks = new Map();
async function withLock(key, fn) {
    const previous = _locks.get(key) ?? Promise.resolve();
    let releaseLock;
    const next = new Promise((resolve) => {
        releaseLock = resolve;
    });
    _locks.set(key, previous.then(() => next));
    await previous;
    try {
        return await fn();
    }
    finally {
        releaseLock();
        if (_locks.get(key) === next) {
            _locks.delete(key);
        }
    }
}
class LobbyService {
    io;
    constructor(io) {
        this.io = io;
    }
    storage = (0, storage_factory_1.getStorage)();
    emptyLobbyTimers = new Map();
    // Tracks pending countdown timers so we can cancel them on host disconnect.
    countdownTimers = new Map();
    // ─── Normalisation helpers ────────────────────────────────────────────────
    /**
     * Single canonical userId normaliser.  Always call this before comparing
     * or storing a userId so that string "1" and number 1 are treated as equal.
     * Storage reads/writes go through setMember / getMember which also
     * normalise, so handler logic never needs to call this directly unless it
     * is doing a comparison outside of storage.
     */
    normalizeUserId(userId) {
        return String(userId);
    }
    normalizeCode(code) {
        if (typeof code !== 'string' || !code.trim()) {
            throw new custom_error_1.CustomError('Invalid lobby code');
        }
        return code.trim();
    }
    // ─── Quiz-id encode / decode helpers ─────────────────────────────────────
    decodeIncomingQuizId(encodedQuizId) {
        if (typeof encodedQuizId !== 'string' || !encodedQuizId.trim()) {
            throw new custom_error_1.CustomError('Invalid quiz id');
        }
        const quizId = (0, hash_1.decodeQuizId)(encodedQuizId);
        if (!quizId || !Number.isInteger(quizId) || quizId <= 0) {
            throw new custom_error_1.CustomError('Invalid quiz id');
        }
        return quizId;
    }
    encodeStoredQuizId(quizId) {
        const numericQuizId = Number(quizId);
        if (!Number.isInteger(numericQuizId) || numericQuizId <= 0) {
            throw new custom_error_1.CustomError('Invalid stored quiz id');
        }
        const encoded = (0, hash_1.encodeQuizId)(numericQuizId);
        if (!encoded) {
            throw new custom_error_1.CustomError('Failed to encode quiz id');
        }
        return encoded;
    }
    // ─── Client serialisation ─────────────────────────────────────────────────
    /** Never expose raw quizId to socket clients. */
    serializeLobbyForClient(lobby) {
        if (!lobby)
            return null;
        return {
            ...lobby,
            quizId: this.encodeStoredQuizId(lobby.quizId),
        };
    }
    serializeLobbyStateForClient(state) {
        return {
            ...state,
            lobby: this.serializeLobbyForClient(state.lobby),
        };
    }
    // ─── Storage helpers ──────────────────────────────────────────────────────
    async getLobbyOrThrow(code) {
        const lobby = await this.storage.getLobbyByCode(code);
        if (!lobby) {
            throw new custom_error_1.CustomError('Lobby not found');
        }
        if (lobby.status === 'closed') {
            throw new custom_error_1.CustomError('Lobby no longer exists');
        }
        return lobby;
    }
    async getLobbyState(code) {
        const lobby = await this.storage.getLobbyByCode(code);
        const members = await this.storage.listMembers(code);
        const progress = await this.storage.listMemberProgress(code);
        return { lobby, members, progress };
    }
    async emitLobbyState(code) {
        const state = await this.getLobbyState(code);
        const clientState = this.serializeLobbyStateForClient(state);
        this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_STATE, clientState);
        return clientState;
    }
    // ─── Empty-lobby destruction timer ───────────────────────────────────────
    clearEmptyLobbyTimer(code) {
        const timer = this.emptyLobbyTimers.get(code);
        if (timer) {
            clearTimeout(timer);
            this.emptyLobbyTimers.delete(code);
        }
    }
    // ─── scheduleEmptyLobbyDestroy ────────────────────────────────────────────────
    scheduleEmptyLobbyDestroy(code) {
        this.clearEmptyLobbyTimer(code);
        const timer = setTimeout(async () => {
            try {
                const lobby = await this.storage.getLobbyByCode(code);
                if (!lobby)
                    return;
                const members = await this.storage.listMembers(code);
                if (members.length > 0)
                    return;
                await this.storage.updateLobby(code, (l) => ({
                    ...l,
                    status: 'closed',
                    updatedAt: Date.now(),
                }));
                await this.storage.deleteLobby(code);
                // Notify main backend that the quiz session is finished
                try {
                    const encodedQuizId = this.encodeStoredQuizId(lobby.quizId);
                    await main_backend_service_1.mainBackendService.setQuizFinished(encodedQuizId);
                }
                catch {
                    // Don't let backend call failure block cleanup
                }
                this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_DESTROYED);
                this.io.in(code).socketsLeave(code);
            }
            catch {
                // Ignore cleanup errors
            }
            finally {
                this.emptyLobbyTimers.delete(code);
            }
        }, EMPTY_LOBBY_TTL_MS);
        timer.unref?.();
        this.emptyLobbyTimers.set(code, timer);
    }
    // ─── Countdown timer management ───────────────────────────────────────────
    clearCountdownTimer(code) {
        const timer = this.countdownTimers.get(code);
        if (timer) {
            clearTimeout(timer);
            this.countdownTimers.delete(code);
        }
    }
    /**
     * Schedules the transition from 'starting' → 'started' after COUNTDOWN_MS.
     * If the host disconnects before the timer fires, cancelCountdown() reverts
     * the lobby to 'waiting' and emits LOBBY_CANCELLED instead.
     */
    scheduleCountdownTransition(code) {
        this.clearCountdownTimer(code);
        const timer = setTimeout(async () => {
            this.countdownTimers.delete(code);
            try {
                await this.storage.updateLobby(code, (l) => {
                    // Only advance if still in 'starting' (not already cancelled)
                    if (l.status !== 'starting')
                        return l;
                    return { ...l, status: 'started', updatedAt: Date.now() };
                });
                await this.emitLobbyState(code);
            }
            catch {
                // Ignore — lobby may have been destroyed
            }
        }, COUNTDOWN_MS);
        timer.unref?.();
        this.countdownTimers.set(code, timer);
    }
    /**
     * Cancels an in-progress countdown (e.g. host disconnected mid-countdown).
     * Reverts lobby to 'waiting', clears joinLocked, and emits LOBBY_CANCELLED.
     */
    async cancelCountdown(code) {
        this.clearCountdownTimer(code);
        try {
            const lobby = await this.storage.getLobbyByCode(code);
            if (!lobby || lobby.status !== 'starting')
                return;
            await this.storage.updateLobby(code, (l) => ({
                ...l,
                status: 'waiting',
                joinLocked: false,
                startedAt: undefined,
                updatedAt: Date.now(),
            }));
            this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_CANCELLED);
            await this.emitLobbyState(code);
        }
        catch {
            // Ignore cleanup errors
        }
    }
    // ─── Host reassignment ────────────────────────────────────────────────────
    async reassignHostIfNeeded(code, leavingUserId) {
        const lobby = await this.storage.getLobbyByCode(code);
        if (!lobby)
            return;
        const leavingId = this.normalizeUserId(leavingUserId);
        if (this.normalizeUserId(lobby.hostUserId) !== leavingId) {
            return;
        }
        const members = await this.storage.listMembers(code);
        const remaining = members.filter((m) => this.normalizeUserId(m.userId) !== leavingId);
        if (remaining.length === 0)
            return;
        const connected = remaining.filter((m) => m.connected);
        const nextHost = connected.sort((a, b) => a.joinedAt - b.joinedAt)[0] ??
            remaining.sort((a, b) => a.joinedAt - b.joinedAt)[0];
        await this.storage.setMember(code, { ...nextHost, isHost: true });
        await this.storage.updateLobby(code, (l) => ({
            ...l,
            hostUserId: nextHost.userId,
            updatedAt: Date.now(),
        }));
    }
    // ─── Disconnect handler ───────────────────────────────────────────────────
    async handleDisconnect(socket) {
        const user = socket.data.user;
        if (!user?.id)
            return;
        const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
        for (const code of rooms) {
            try {
                const member = await this.storage.getMember(code, user.id);
                if (!member)
                    continue;
                await this.storage.setMember(code, {
                    ...member,
                    connected: false,
                    socketId: undefined,
                });
                const lobby = await this.storage.getLobbyByCode(code);
                // If host disconnects during countdown, cancel it and revert.
                if (lobby &&
                    lobby.status === 'starting' &&
                    this.normalizeUserId(lobby.hostUserId) ===
                        this.normalizeUserId(user.id)) {
                    await this.cancelCountdown(code);
                    continue;
                }
                const members = await this.storage.listMembers(code);
                const connectedCount = members.filter((m) => m.connected).length;
                if (connectedCount === 0) {
                    this.scheduleEmptyLobbyDestroy(code);
                }
                else {
                    await this.reassignHostIfNeeded(code, user.id);
                    await this.emitLobbyState(code);
                }
            }
            catch {
                // Ignore per-lobby errors; try other rooms
            }
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Public handlers
    // ═══════════════════════════════════════════════════════════════════════════
    async setReady(socket, payload) {
        const { code, isReady } = payload;
        const userId = socket.data.user?.id;
        if (!code)
            throw new Error('Lobby code is required');
        if (typeof isReady !== 'boolean')
            throw new Error('isReady must be boolean');
        if (!userId)
            throw new Error('Unauthorized');
        const member = await this.storage.getMember(code, userId);
        if (!member)
            throw new Error('Member not found');
        if (member.isHost)
            throw new Error('Host does not need to be ready');
        await this.storage.setMember(code, { ...member, isReady });
        const lobby = await this.getLobbyOrThrow(code);
        const members = await this.storage.listMembers(code);
        const progress = await this.storage.listMemberProgress(code);
        this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_STATE, {
            lobby: this.serializeLobbyForClient(lobby),
            members,
            progress,
        });
        return { lobby, members, progress };
    }
    async notifyLobby(socket, payload) {
        const { code, message, type } = payload;
        this.io.to(code).emit('lobby_notification', { message, type });
    }
    // ─── createLobby ──────────────────────────────────────────────────────────
    async createLobby(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        return withLock(`lobby:${code}`, async () => {
            const rawQuizId = this.decodeIncomingQuizId(dto.quizId);
            const encodedQuizId = this.encodeStoredQuizId(rawQuizId);
            const quiz = await main_backend_service_1.mainBackendService.getQuizMetadata(encodedQuizId, socket.data.accessToken);
            const LOBBY_MAX_MEMBERS = dto.maxMembers ?? 10;
            const existingLobby = await this.storage.getLobbyByCode(code);
            if (existingLobby) {
                throw new custom_error_1.CustomError('Lobby code already exists');
            }
            const lobby = {
                code,
                quizId: rawQuizId,
                hostUserId: user.id,
                status: 'waiting',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                questionCount: quiz.questionCount,
                maxMembers: LOBBY_MAX_MEMBERS,
                // joinLocked is for manual pre-start locking by the host.
                // It is independent of status: 'starting'/'started' which are
                // the post-start gates.  A locked-but-waiting lobby rejects new
                // members while still allowing the host to start.
                joinLocked: false,
            };
            await this.storage.createLobby(lobby);
            const member = {
                userId: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                trophies: user.trophies ?? 0,
                isHost: true,
                isReady: true,
                joinedAt: Date.now(),
                connected: true,
                socketId: socket.id,
            };
            await this.storage.setMember(code, member);
            await main_backend_service_1.mainBackendService.addQuizMember({
                quizId: encodedQuizId,
                userId: user.id,
                role: 'creator',
                accessToken: socket.data.accessToken,
            });
            this.clearEmptyLobbyTimer(code);
            socket.join(code);
            return {
                code,
                lobby: this.serializeLobbyForClient(lobby),
            };
        });
    }
    async joinLobby(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        return withLock(`lobby:${code}`, async () => {
            const lobby = await this.getLobbyOrThrow(code);
            const members = await this.storage.listMembers(code);
            const userId = this.normalizeUserId(user.id);
            // Primary lookup from list; fall back to direct storage read
            // in case listMembers returns stale data or the user's previous
            // entry was written by a different code path (e.g. createLobby).
            let existingMember = members.find((m) => this.normalizeUserId(m.userId) === userId) ??
                (await this.storage.getMember(code, userId)) ??
                null;
            if (!existingMember) {
                if (lobby.status !== 'waiting' && lobby.status !== 'starting') {
                    throw new custom_error_1.CustomError('Lobby already started');
                }
                if (lobby.joinLocked) {
                    throw new custom_error_1.CustomError('Lobby is locked');
                }
                if (members.length >= lobby.maxMembers) {
                    throw new custom_error_1.CustomError('Lobby is full');
                }
            }
            const isEmptyLobby = members.length === 0;
            const memberToSave = existingMember
                ? { ...existingMember, connected: true, socketId: socket.id }
                : {
                    userId: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    trophies: user.trophies ?? 0,
                    isHost: isEmptyLobby,
                    isReady: false,
                    joinedAt: Date.now(),
                    connected: true,
                    socketId: socket.id,
                };
            await this.storage.setMember(code, memberToSave);
            if (isEmptyLobby) {
                await this.storage.updateLobby(code, (l) => ({
                    ...l,
                    status: 'waiting',
                    joinLocked: false,
                    hostUserId: user.id,
                    updatedAt: Date.now(),
                }));
            }
            const encodedQuizId = this.encodeStoredQuizId(lobby.quizId);
            // Only call the backend when truly a new member — not on reconnect.
            if (!existingMember) {
                const quiz = await main_backend_service_1.mainBackendService.getQuizMetadata(encodedQuizId, socket.data.accessToken);
                const creatorId = this.normalizeUserId(quiz.creatorId ?? quiz.ownerId ?? '');
                const isCreator = creatorId !== '' && creatorId === userId;
                if (!isCreator) {
                    await main_backend_service_1.mainBackendService.addQuizMember({
                        quizId: encodedQuizId,
                        userId: user.id,
                        role: 'member',
                        accessToken: socket.data.accessToken,
                    });
                }
            }
            this.clearEmptyLobbyTimer(code);
            socket.join(code);
            // Re-read lobby AFTER joining — host may have started mid-join.
            const currentLobby = await this.storage.getLobbyByCode(code);
            if (currentLobby?.status === 'started' && currentLobby.startedAt) {
                socket.emit(lobby_events_1.LobbyEvents.LOBBY_STARTED, {
                    ...this.serializeLobbyForClient(currentLobby),
                    startedAt: currentLobby.startedAt,
                    serverNow: Date.now(),
                });
            }
            else if (currentLobby?.status === 'starting' && currentLobby.startedAt) {
                socket.emit(lobby_events_1.LobbyEvents.LOBBY_STARTING, {
                    ...this.serializeLobbyForClient(currentLobby),
                    startedAt: currentLobby.startedAt,
                    serverNow: Date.now(),
                });
            }
            return await this.emitLobbyState(code);
        });
    }
    async rejoinLobby(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        return withLock(`lobby:${code}`, async () => {
            const lobby = await this.storage.getLobbyByCode(code);
            if (!lobby || lobby.status === 'closed') {
                return { ok: false, reason: 'LOBBY_NOT_FOUND' };
            }
            const userId = this.normalizeUserId(user.id);
            const existingMember = await this.storage.getMember(code, userId);
            if (!existingMember) {
                return { ok: false, reason: 'NOT_A_MEMBER' };
            }
            await this.storage.setMember(code, {
                ...existingMember,
                connected: true,
                socketId: socket.id,
            });
            this.clearEmptyLobbyTimer(code);
            socket.join(code);
            // Re-read lobby AFTER joining — status may have changed mid-rejoin
            const currentLobby = await this.storage.getLobbyByCode(code);
            if (currentLobby?.status === 'started' && currentLobby.startedAt) {
                socket.emit(lobby_events_1.LobbyEvents.LOBBY_STARTED, {
                    ...this.serializeLobbyForClient(currentLobby),
                    startedAt: currentLobby.startedAt,
                    serverNow: Date.now(),
                });
            }
            else if (currentLobby?.status === 'starting' && currentLobby.startedAt) {
                socket.emit(lobby_events_1.LobbyEvents.LOBBY_STARTING, {
                    ...this.serializeLobbyForClient(currentLobby),
                    startedAt: currentLobby.startedAt,
                    serverNow: Date.now(),
                });
            }
            const state = await this.emitLobbyState(code);
            return { ok: true, state };
        });
    }
    // ─── startLobby ───────────────────────────────────────────────────────────
    //
    // Transitions: waiting → starting (broadcast LOBBY_STARTING with startedAt)
    //              then after COUNTDOWN_MS: starting → started (broadcast LOBBY_STARTED).
    //
    // The 'starting' grace window means:
    //   • Late joiners still accepted (status === 'starting' passes joinLobby check)
    //   • If host disconnects mid-countdown, cancelCountdown() reverts to 'waiting'
    //
    // startedAt is a server-epoch point in the future (now + COUNTDOWN_MS).
    // Clients derive remaining time as:  remaining = startedAt - Date.now()
    // adjusted for transmission lag using the serverNow field in the payload.
    async startLobby(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        return withLock(`lobby:${code}`, async () => {
            const lobby = await this.getLobbyOrThrow(code);
            if (this.normalizeUserId(lobby.hostUserId) !== this.normalizeUserId(user.id)) {
                throw new custom_error_1.CustomError('Only host can start');
            }
            if (lobby.status !== 'waiting') {
                throw new custom_error_1.CustomError('Lobby already started');
            }
            const members = await this.storage.listMembers(code);
            if (members.length === 0) {
                throw new custom_error_1.CustomError('No members in lobby');
            }
            const nonHostMembers = members.filter((m) => !m.isHost);
            const unreadyMembers = nonHostMembers.filter((m) => !m.isReady);
            if (unreadyMembers.length > 0) {
                // Broadcast one notification to the whole room for unready members,
                // and a separate one to the host only.
                this.io.to(socket.id).emit('lobby_notification', {
                    type: 'warning',
                    message: 'همه بازیکنان باید آماده باشند.',
                });
                // Build a lookup map once (O(n)) instead of a nested find (O(n²)).
                const unreadyUserIds = new Set(unreadyMembers.map((m) => this.normalizeUserId(m.userId)));
                const roomSockets = await this.io.in(code).fetchSockets();
                const socketByUserId = new Map(roomSockets.map((s) => [
                    this.normalizeUserId(s.data.user?.id),
                    s,
                ]));
                for (const uid of unreadyUserIds) {
                    socketByUserId.get(uid)?.emit('lobby_notification', {
                        type: 'info',
                        message: 'میزبان میخواهد شروع کند، لطفا دکمه آماده را بزنید',
                    });
                }
                return { ok: false, reason: 'NOT_ALL_READY' };
            }
            // Transition to 'starting'; the actual 'started' flip happens after
            // COUNTDOWN_MS via scheduleCountdownTransition.
            const startedAt = Date.now() + COUNTDOWN_MS;
            await this.storage.updateLobby(code, (l) => ({
                ...l,
                status: 'starting',
                startedAt,
                joinLocked: true,
                updatedAt: Date.now(),
            }));
            // Emit fresh state before the start event so clients have the
            // complete member list before they react to LOBBY_STARTING.
            await this.emitLobbyState(code);
            this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_STARTING, {
                ...this.serializeLobbyForClient(await this.storage.getLobbyByCode(code)),
                startedAt,
                serverNow: Date.now(),
            });
            // Schedule the 'starting' → 'started' transition server-side.
            // If the host disconnects before this fires, cancelCountdown() will
            // clear the timer and revert the lobby.
            this.scheduleCountdownTransition(code);
            return { ok: true };
        });
    }
    // ─── leaveLobby ───────────────────────────────────────────────────────────
    async leaveLobby(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        await this.storage.removeMember(code, user.id);
        socket.leave(code);
        await this.reassignHostIfNeeded(code, user.id);
        const lobby = await this.storage.getLobbyByCode(code);
        if (!lobby || lobby.status === 'closed')
            return;
        const members = await this.storage.listMembers(code);
        if (members.length === 0) {
            await this.storage.updateLobby(code, (l) => ({
                ...l,
                status: 'waiting',
                joinLocked: false,
                updatedAt: Date.now(),
            }));
            this.scheduleEmptyLobbyDestroy(code);
            return;
        }
        await this.emitLobbyState(code);
    }
    // ─── kickMember ───────────────────────────────────────────────────────────
    async kickMember(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const lobby = await this.getLobbyOrThrow(code);
        if (this.normalizeUserId(lobby.hostUserId) !== this.normalizeUserId(user.id)) {
            throw new custom_error_1.CustomError('Only host can kick');
        }
        if (this.normalizeUserId(lobby.hostUserId) === this.normalizeUserId(dto.targetUserId)) {
            throw new custom_error_1.CustomError('Host cannot be kicked');
        }
        const targetMember = await this.storage.getMember(code, dto.targetUserId);
        await this.storage.removeMember(code, dto.targetUserId);
        this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_MEMBER_KICKED, {
            userId: dto.targetUserId,
        });
        if (targetMember?.socketId) {
            const targetSocket = this.io.sockets.sockets.get(targetMember.socketId);
            if (targetSocket) {
                targetSocket.leave(code);
            }
        }
        await this.emitLobbyState(code);
    }
    // ─── destroyLobby ─────────────────────────────────────────────────────────
    // ─── destroyLobby ─────────────────────────────────────────────────────────────
    async destroyLobby(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const lobby = await this.getLobbyOrThrow(code);
        if (this.normalizeUserId(lobby.hostUserId) !== this.normalizeUserId(user.id)) {
            throw new custom_error_1.CustomError('Only host can destroy');
        }
        this.clearEmptyLobbyTimer(code);
        this.clearCountdownTimer(code);
        await this.storage.updateLobby(code, (l) => ({
            ...l,
            status: 'closed',
            updatedAt: Date.now(),
        }));
        await this.storage.deleteLobby(code);
        // Notify main backend that the quiz session is finished
        try {
            const encodedQuizId = this.encodeStoredQuizId(lobby.quizId);
            await main_backend_service_1.mainBackendService.setQuizFinished(encodedQuizId);
        }
        catch {
            // Log but don't throw — lobby is already destroyed locally
        }
        this.io.to(code).emit(lobby_events_1.LobbyEvents.LOBBY_DESTROYED);
        this.io.in(code).socketsLeave(code);
    }
    // ─── updateProgress ───────────────────────────────────────────────────────
    async updateProgress(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const lobby = await this.getLobbyOrThrow(code);
        let answeredCount = Number(dto.answeredCount);
        if (Number.isNaN(answeredCount))
            answeredCount = 0;
        answeredCount = Math.max(0, Math.min(answeredCount, lobby.questionCount));
        const existing = await this.storage.getMemberProgress(code, user.id);
        if (existing?.finished)
            return;
        // finished is derived server-side; client cannot poison the flag.
        const finished = (dto.finished ?? false) && answeredCount >= lobby.questionCount;
        const progress = {
            userId: user.id,
            answeredCount,
            finished,
            submittedAt: finished ? Date.now() : undefined,
        };
        await this.storage.setMemberProgress(code, progress);
        this.io.to(code).emit(lobby_events_1.LobbyEvents.MEMBER_PROGRESS, progress);
    }
    // ─── submitQuiz ───────────────────────────────────────────────────────────
    async submitQuiz(socket, dto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        return withLock(`submit:${code}:${user.id}`, async () => {
            const lobby = await this.getLobbyOrThrow(code);
            const existingProgress = await this.storage.getMemberProgress(code, user.id);
            if (existingProgress?.finished) {
                throw new custom_error_1.CustomError('Already submitted');
            }
            const encodedQuizId = this.encodeStoredQuizId(lobby.quizId);
            const result = await main_backend_service_1.mainBackendService.gradeQuizSubmission({
                quizId: encodedQuizId,
                userId: user.id,
                lobbyCode: code,
                answers: dto.answers,
                timeSpent: dto.timeSpent,
                questionTimes: dto.questionTimes,
                selectionLog: dto.selectionLog,
                accessToken: socket.data.accessToken,
            });
            await this.storage.setMemberProgress(code, {
                ...(existingProgress ?? {
                    userId: user.id,
                    answeredCount: 0,
                    finished: true,
                }),
                finished: true,
                result,
                submittedAt: Date.now(),
            });
            const saveResponse = await main_backend_service_1.mainBackendService.saveQuizResult({
                quizId: encodedQuizId,
                userId: user.id,
                lobbyCode: code,
                result,
                accessToken: socket.data.accessToken,
            });
            if (saveResponse?.resultId) {
                const encodedId = (0, hash_1.encodeResultId)(saveResponse.resultId);
                result.resultId = encodedId;
                result.id = encodedId;
            }
            this.io.to(socket.id).emit(lobby_events_1.LobbyEvents.QUIZ_RESULT, result);
            const allProgress = await this.storage.listMemberProgress(code);
            const finishedCount = allProgress.filter((p) => p.finished).length;
            const members = await this.storage.listMembers(code);
            if (finishedCount === members.length) {
                await this.storage.updateLobby(code, (l) => ({
                    ...l,
                    status: 'results',
                    resultsAt: Date.now(),
                    updatedAt: Date.now(),
                }));
                await this.storage.scheduleLobbyExpiry(code, Date.now() + env_1.env.RESULTS_TTL_SECONDS * 1000);
                await this.emitLobbyState(code);
            }
            return result;
        });
    }
}
exports.LobbyService = LobbyService;
