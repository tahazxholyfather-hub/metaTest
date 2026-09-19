import { Server, Socket } from 'socket.io';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { getStorage } from '../../../storage/storage.factory';
import { mainBackendService } from '../../../services/main-backend.service';
import { LobbyEventAliases, LobbyEvents } from '../events/lobby.events';
import { CustomError } from '../../../core/exceptions/custom-error';
import { withLock } from '../../../core/lock';
import {
    Lobby,
    LobbyMember,
    LobbyMemberProgress,
    SerializedLobby,
} from '../../../core/types/lobby.types';
import {
    CreateLobbyDto,
    DestroyLobbyDto,
    JoinLobbyDto,
    KickMemberDto,
    LeaveLobbyDto,
    NotifyLobbyDto,
    RejoinLobbyDto,
    SetReadyDto,
    StartLobbyDto,
    SubmitQuizDto,
    UpdateProgressDto,
} from '../dtos/lobby.schema';
import { encodeQuizId, decodeQuizId, encodeResultId } from '../../../utils/hash';

const COUNTDOWN_MS = 3000;
const EMPTY_LOBBY_TTL_MS = 60_000;

function lobbyLockKey(code: string): string {
    return `lobby:${code}`;
}

export class LobbyService {
    constructor(private io: Server) {}

    private storage = getStorage();
    private emptyLobbyTimers = new Map<string, NodeJS.Timeout>();
    private countdownTimers = new Map<string, NodeJS.Timeout>();
    private graceDisconnectTimers = new Map<string, NodeJS.Timeout>();

    attachIo(io: Server): void {
        this.io = io;
    }

    private normalizeUserId(userId: string | number): string {
        return String(userId);
    }

    private normalizeCode(code: unknown): string {
        if (typeof code !== 'string' || !code.trim()) {
            throw new CustomError('Invalid lobby code', 400, 'INVALID_LOBBY_CODE');
        }
        return code.trim();
    }

    private decodeIncomingQuizId(encodedQuizId: unknown): number {
        if (typeof encodedQuizId !== 'string' || !encodedQuizId.trim()) {
            throw new CustomError('Invalid quiz id', 400, 'INVALID_QUIZ_ID');
        }
        const quizId = decodeQuizId(encodedQuizId);
        if (!quizId || !Number.isInteger(quizId) || quizId <= 0) {
            throw new CustomError('Invalid quiz id', 400, 'INVALID_QUIZ_ID');
        }
        return quizId;
    }

    private encodeStoredQuizId(quizId: string | number): string {
        const numericQuizId = Number(quizId);
        if (!Number.isInteger(numericQuizId) || numericQuizId <= 0) {
            throw new CustomError('Invalid stored quiz id', 500, 'INVALID_STORED_QUIZ_ID');
        }
        const encoded = encodeQuizId(numericQuizId);
        if (!encoded) {
            throw new CustomError('Failed to encode quiz id', 500, 'QUIZ_ID_ENCODE_FAILED');
        }
        return encoded;
    }

    private serializeLobbyForClient(lobby: Lobby | null): SerializedLobby | null {
        if (!lobby) return null;
        return {
            ...lobby,
            quizId: this.encodeStoredQuizId(lobby.quizId),
            seq: lobby.seq ?? 0,
        };
    }

    private connectedCount(members: LobbyMember[]): number {
        return members.filter((member) => member.connected).length;
    }

    private isActivePlayStatus(status: Lobby['status']): boolean {
        return status === 'starting' || status === 'started' || status === 'results';
    }

    private shouldFinishQuiz(lobby: Lobby | null): boolean {
        return Boolean(lobby && (lobby.status === 'started' || lobby.status === 'results'));
    }

    private graceKey(code: string, userId: string): string {
        return `${code}:${userId}`;
    }

    private nextSeq(lobby: Lobby): number {
        return (lobby.seq ?? 0) + 1;
    }

    async getLobbyState(code: string) {
        const lobby = await this.storage.getLobbyByCode(code);
        const members = await this.storage.listMembers(code);
        const progress = await this.storage.listMemberProgress(code);
        return { lobby, members, progress };
    }

    private async emitLobbyState(code: string) {
        const state = await this.getLobbyState(code);
        const clientState = {
            lobby: this.serializeLobbyForClient(state.lobby),
            members: state.members,
            progress: state.progress,
            seq: state.lobby?.seq ?? 0,
            serverNow: Date.now(),
        };
        this.io.to(code).emit(LobbyEvents.LOBBY_STATE, clientState);
        return clientState;
    }

    private async getLobbyOrThrow(code: string): Promise<Lobby> {
        const lobby = await this.storage.getLobbyByCode(code);
        if (!lobby) {
            throw new CustomError('Lobby not found', 404, 'LOBBY_NOT_FOUND');
        }
        if (lobby.status === 'closed') {
            throw new CustomError('Lobby no longer exists', 404, 'LOBBY_CLOSED');
        }
        return lobby;
    }

    private async requireMember(code: string, userId: string | number): Promise<LobbyMember> {
        const member = await this.storage.getMember(code, userId);
        if (!member) {
            throw new CustomError('Member not found', 403, 'NOT_A_MEMBER');
        }
        return member;
    }

    private emitNotification(
        code: string,
        payload: { message: string; type: 'info' | 'warning' | 'error' | 'success' },
        socketId?: string,
    ) {
        const target = socketId ? this.io.to(socketId) : this.io.to(code);
        target.emit(LobbyEvents.NOTIFICATION, payload);
        target.emit(LobbyEventAliases.NOTIFICATION, payload);
    }

    private emitStarting(code: string, payload: Record<string, unknown>) {
        this.io.to(code).emit(LobbyEvents.LOBBY_STARTING, payload);
        this.io.to(code).emit(LobbyEventAliases.STARTING, payload);
    }

    private emitStarted(code: string, payload: Record<string, unknown>) {
        this.io.to(code).emit(LobbyEvents.LOBBY_STARTED, payload);
    }

    private emitCancelled(code: string) {
        const payload = { code, serverNow: Date.now() };
        this.io.to(code).emit(LobbyEvents.LOBBY_CANCELLED, payload);
        this.io.to(code).emit(LobbyEventAliases.CANCELLED, payload);
    }

    private emitDestroyed(code: string, reason: string) {
        const payload = { code, reason, serverNow: Date.now() };
        this.io.to(code).emit(LobbyEvents.LOBBY_DESTROYED, payload);
    }

    private emitKicked(code: string, userId: string) {
        const payload = { code, userId, serverNow: Date.now() };
        this.io.to(code).emit(LobbyEvents.LOBBY_KICKED, payload);
        this.io.to(code).emit(LobbyEventAliases.KICKED, payload);
    }

    private emitPresence(code: string, userId: string, online: boolean) {
        const payload = { code, userId, serverNow: Date.now() };
        this.io.to(code).emit(
            online ? LobbyEvents.MEMBER_ONLINE : LobbyEvents.MEMBER_OFFLINE,
            payload,
        );
    }

    private async finishQuizIfNeeded(lobby: Lobby | null): Promise<void> {
        if (!this.shouldFinishQuiz(lobby)) return;
        try {
            const encodedQuizId = this.encodeStoredQuizId(lobby!.quizId);
            await mainBackendService.setQuizFinished(encodedQuizId);
        } catch (err) {
            logger.warn({ err, code: lobby?.code }, 'Failed to mark quiz finished');
        }
    }

    private clearEmptyLobbyTimer(code: string) {
        const timer = this.emptyLobbyTimers.get(code);
        if (timer) {
            clearTimeout(timer);
            this.emptyLobbyTimers.delete(code);
        }
    }

    private clearCountdownTimer(code: string) {
        const timer = this.countdownTimers.get(code);
        if (timer) {
            clearTimeout(timer);
            this.countdownTimers.delete(code);
        }
    }

    private clearGraceDisconnect(code: string, userId: string) {
        const key = this.graceKey(code, userId);
        const timer = this.graceDisconnectTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.graceDisconnectTimers.delete(key);
        }
    }

    private scheduleEmptyLobbyDestroy(code: string) {
        this.clearEmptyLobbyTimer(code);

        const timer = setTimeout(() => {
            void this.destroyEmptyLobby(code);
        }, EMPTY_LOBBY_TTL_MS);

        timer.unref?.();
        this.emptyLobbyTimers.set(code, timer);
    }

    private async destroyEmptyLobby(code: string) {
        this.emptyLobbyTimers.delete(code);

        await withLock(lobbyLockKey(code), async () => {
            const lobby = await this.storage.getLobbyByCode(code);
            if (!lobby) return;

            const members = await this.storage.listMembers(code);
            if (this.connectedCount(members) > 0) return;

            this.clearCountdownTimer(code);
            await this.storage.deleteLobby(code);
            await this.finishQuizIfNeeded(lobby);
            this.emitDestroyed(code, 'empty');
            this.io.in(code).socketsLeave(code);
        });
    }

    private scheduleCountdownTransition(code: string) {
        this.clearCountdownTimer(code);

        const timer = setTimeout(() => {
            this.countdownTimers.delete(code);
            void this.completeCountdown(code);
        }, COUNTDOWN_MS);

        timer.unref?.();
        this.countdownTimers.set(code, timer);
    }

    private async completeCountdown(code: string) {
        await withLock(lobbyLockKey(code), async () => {
            const lobby = await this.storage.getLobbyByCode(code);
            if (!lobby || lobby.status !== 'starting') return;

            await this.storage.updateLobby(code, (current) => ({
                ...current,
                status: 'started',
                seq: this.nextSeq(current),
                updatedAt: Date.now(),
            }));

            const serialized = this.serializeLobbyForClient(
                await this.storage.getLobbyByCode(code),
            );
            await this.emitLobbyState(code);
            this.emitStarted(code, {
                ...serialized,
                startedAt: lobby.startedAt,
                serverNow: Date.now(),
            });
        });
    }

    private async cancelCountdown(code: string) {
        this.clearCountdownTimer(code);

        const lobby = await this.storage.getLobbyByCode(code);
        if (!lobby || lobby.status !== 'starting') return;

        await this.storage.updateLobby(code, (current) => ({
            ...current,
            status: 'waiting',
            joinLocked: false,
            startedAt: undefined,
            seq: this.nextSeq(current),
            updatedAt: Date.now(),
        }));

        this.emitCancelled(code);
        await this.emitLobbyState(code);
    }

    private async syncHostFlags(code: string, hostUserId: string) {
        const hostId = this.normalizeUserId(hostUserId);
        const members = await this.storage.listMembers(code);

        for (const member of members) {
            const shouldBeHost = this.normalizeUserId(member.userId) === hostId;
            if (member.isHost !== shouldBeHost) {
                await this.storage.setMember(code, { ...member, isHost: shouldBeHost });
            }
        }

        await this.storage.updateLobby(code, (lobby) => ({
            ...lobby,
            hostUserId: hostId,
            seq: this.nextSeq(lobby),
            updatedAt: Date.now(),
        }));
    }

    private async reassignHostIfNeeded(code: string, leavingUserId: string | number) {
        const lobby = await this.storage.getLobbyByCode(code);
        if (!lobby) return;

        const leavingId = this.normalizeUserId(leavingUserId);
        if (this.normalizeUserId(lobby.hostUserId) !== leavingId) {
            return;
        }

        const members = await this.storage.listMembers(code);
        const remaining = members.filter(
            (member) => this.normalizeUserId(member.userId) !== leavingId,
        );
        if (remaining.length === 0) return;

        const connected = remaining.filter((member) => member.connected);
        const nextHost =
            connected.sort((a, b) => a.joinedAt - b.joinedAt)[0] ??
            remaining.sort((a, b) => a.joinedAt - b.joinedAt)[0];

        await this.syncHostFlags(code, nextHost.userId);
    }

    private scheduleGraceDisconnect(code: string, userId: string, socketId: string) {
        this.clearGraceDisconnect(code, userId);

        const apply = () => {
            this.graceDisconnectTimers.delete(this.graceKey(code, userId));
            void this.applyGraceDisconnect(code, userId, socketId);
        };

        if (env.DISCONNECT_GRACE_MS <= 0) {
            apply();
            return;
        }

        const timer = setTimeout(apply, env.DISCONNECT_GRACE_MS);
        timer.unref?.();
        this.graceDisconnectTimers.set(this.graceKey(code, userId), timer);
    }

    private async applyGraceDisconnect(code: string, userId: string, socketId: string) {
        await withLock(lobbyLockKey(code), async () => {
            const member = await this.storage.getMember(code, userId);
            if (!member) return;
            if (member.socketId && member.socketId !== socketId) return;

            await this.storage.setMember(code, {
                ...member,
                connected: false,
                socketId: undefined,
            });

            this.emitPresence(code, userId, false);

            const lobby = await this.storage.getLobbyByCode(code);
            if (
                lobby &&
                lobby.status === 'starting' &&
                this.normalizeUserId(lobby.hostUserId) === userId
            ) {
                await this.cancelCountdown(code);
            }

            const members = await this.storage.listMembers(code);
            if (this.connectedCount(members) === 0) {
                this.scheduleEmptyLobbyDestroy(code);
                return;
            }

            await this.reassignHostIfNeeded(code, userId);
            await this.emitLobbyState(code);
        });
    }

    async handleDisconnect(socket: Socket) {
        const user = socket.data.user;
        if (!user?.id) return;

        const userId = this.normalizeUserId(user.id);
        const binding = await this.storage.getUserBinding(userId);
        if (binding && binding.socketId !== socket.id) {
            return;
        }

        const rooms = new Set<string>();
        for (const room of socket.rooms) {
            if (room !== socket.id) rooms.add(room);
        }
        if (binding?.lobbyCode) rooms.add(binding.lobbyCode);

        for (const code of rooms) {
            const member = await this.storage.getMember(code, userId);
            if (!member) continue;
            if (member.socketId && member.socketId !== socket.id) continue;
            this.scheduleGraceDisconnect(code, userId, socket.id);
        }
    }

    async setReady(socket: Socket, payload: SetReadyDto) {
        const code = this.normalizeCode(payload.code);
        const userId = this.normalizeUserId(socket.data.user?.id);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.getLobbyOrThrow(code);
            if (lobby.status !== 'waiting') {
                throw new CustomError('Ready state is locked', 409, 'LOBBY_NOT_WAITING');
            }

            const member = await this.requireMember(code, userId);
            if (member.isHost || this.normalizeUserId(lobby.hostUserId) === userId) {
                throw new CustomError('Host does not need to be ready', 400, 'HOST_READY_NOT_REQUIRED');
            }

            await this.storage.setMember(code, { ...member, isReady: payload.isReady });
            await this.storage.updateLobby(code, (current) => ({
                ...current,
                seq: this.nextSeq(current),
                updatedAt: Date.now(),
            }));

            return this.emitLobbyState(code);
        });
    }

    async notifyLobby(socket: Socket, payload: NotifyLobbyDto) {
        const code = this.normalizeCode(payload.code);
        const userId = this.normalizeUserId(socket.data.user?.id);
        await this.requireMember(code, userId);
        this.emitNotification(code, {
            message: payload.message,
            type: payload.type,
        });
        return { ok: true };
    }

    async createLobby(socket: Socket, dto: CreateLobbyDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);

        return withLock(lobbyLockKey(code), async () => {
            const rawQuizId = this.decodeIncomingQuizId(dto.quizId);
            const encodedQuizId = this.encodeStoredQuizId(rawQuizId);
            const quiz = await mainBackendService.getQuizMetadata(
                encodedQuizId,
                socket.data.accessToken,
            );

            const requestedMax = dto.maxMembers ?? env.LOBBY_MAX_MEMBERS;
            const maxMembers = Math.min(
                Math.max(2, requestedMax),
                env.LOBBY_MAX_MEMBERS,
            );

            const existingLobby = await this.storage.getLobbyByCode(code);
            if (existingLobby && existingLobby.status !== 'closed') {
                throw new CustomError('Lobby code already exists', 409, 'LOBBY_EXISTS');
            }

            const now = Date.now();
            const lobby: Lobby = {
                code,
                quizId: rawQuizId,
                hostUserId: this.normalizeUserId(user.id),
                status: 'waiting',
                createdAt: now,
                updatedAt: now,
                questionCount: quiz.questionCount,
                maxMembers,
                joinLocked: false,
                seq: 1,
            };

            await this.storage.createLobby(lobby);

            const member: LobbyMember = {
                userId: this.normalizeUserId(user.id),
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl ?? undefined,
                trophies: user.trophies ?? 0,
                isHost: true,
                isReady: true,
                joinedAt: now,
                connected: true,
                socketId: socket.id,
            };

            await this.storage.setMember(code, member);

            try {
                await mainBackendService.addQuizMember({
                    quizId: encodedQuizId,
                    userId: user.id,
                    role: 'creator',
                    accessToken: socket.data.accessToken,
                });
            } catch (err) {
                await this.storage.deleteLobby(code);
                throw err;
            }

            this.clearEmptyLobbyTimer(code);
            this.clearGraceDisconnect(code, member.userId);
            socket.join(code);

            return {
                code,
                lobby: this.serializeLobbyForClient(lobby),
                seq: lobby.seq,
                serverNow: Date.now(),
            };
        });
    }

    async joinLobby(socket: Socket, dto: JoinLobbyDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.getLobbyOrThrow(code);
            const members = await this.storage.listMembers(code);
            const userId = this.normalizeUserId(user.id);

            const existingMember =
                members.find((member) => this.normalizeUserId(member.userId) === userId) ??
                (await this.storage.getMember(code, userId)) ??
                null;

            if (!existingMember) {
                if (lobby.status !== 'waiting' && lobby.status !== 'starting') {
                    throw new CustomError('Lobby already started', 409, 'LOBBY_ALREADY_STARTED');
                }
                if (lobby.joinLocked) {
                    throw new CustomError('Lobby is locked', 409, 'LOBBY_LOCKED');
                }
                if (members.length >= lobby.maxMembers) {
                    throw new CustomError('Lobby is full', 409, 'LOBBY_FULL');
                }
            }

            const isEmptyLobby = members.length === 0;
            const memberToSave: LobbyMember = existingMember
                ? {
                    ...existingMember,
                    connected: true,
                    socketId: socket.id,
                    username: user.username ?? existingMember.username,
                    displayName: user.displayName ?? existingMember.displayName,
                    avatarUrl: user.avatarUrl ?? existingMember.avatarUrl,
                    trophies: user.trophies ?? existingMember.trophies,
                }
                : {
                    userId,
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl ?? undefined,
                    trophies: user.trophies ?? 0,
                    isHost: isEmptyLobby,
                    isReady: false,
                    joinedAt: Date.now(),
                    connected: true,
                    socketId: socket.id,
                };

            await this.storage.setMember(code, memberToSave);

            if (isEmptyLobby) {
                await this.storage.updateLobby(code, (current) => ({
                    ...current,
                    status: 'waiting',
                    joinLocked: false,
                    hostUserId: userId,
                    seq: this.nextSeq(current),
                    updatedAt: Date.now(),
                }));
            }

            if (!existingMember) {
                try {
                    const encodedQuizId = this.encodeStoredQuizId(lobby.quizId);
                    const quiz = await mainBackendService.getQuizMetadata(
                        encodedQuizId,
                        socket.data.accessToken,
                    );
                    const creatorId = this.normalizeUserId(
                        quiz.creatorId ?? quiz.ownerId ?? '',
                    );
                    const isCreator = creatorId !== '' && creatorId === userId;
                    if (!isCreator) {
                        await mainBackendService.addQuizMember({
                            quizId: encodedQuizId,
                            userId: user.id,
                            role: 'member',
                            accessToken: socket.data.accessToken,
                        });
                    }
                } catch (err) {
                    await this.storage.removeMember(code, userId);
                    throw err;
                }
            }

            this.clearEmptyLobbyTimer(code);
            this.clearGraceDisconnect(code, userId);
            socket.join(code);
            this.emitPresence(code, userId, true);

            const currentLobby = await this.storage.getLobbyByCode(code);
            const serialized = this.serializeLobbyForClient(currentLobby);
            const timedPayload = {
                ...serialized,
                startedAt: currentLobby?.startedAt,
                serverNow: Date.now(),
            };

            if (currentLobby?.status === 'started' && currentLobby.startedAt) {
                socket.emit(LobbyEvents.LOBBY_STARTED, timedPayload);
            } else if (currentLobby?.status === 'starting' && currentLobby.startedAt) {
                socket.emit(LobbyEvents.LOBBY_STARTING, timedPayload);
                socket.emit(LobbyEventAliases.STARTING, timedPayload);
            }

            return this.emitLobbyState(code);
        });
    }

    async rejoinLobby(socket: Socket, dto: RejoinLobbyDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.storage.getLobbyByCode(code);
            if (!lobby || lobby.status === 'closed') {
                return { ok: false, reason: 'LOBBY_NOT_FOUND' as const };
            }

            const userId = this.normalizeUserId(user.id);
            const existingMember = await this.storage.getMember(code, userId);
            if (!existingMember) {
                return { ok: false, reason: 'NOT_A_MEMBER' as const };
            }

            await this.storage.setMember(code, {
                ...existingMember,
                connected: true,
                socketId: socket.id,
            });

            this.clearEmptyLobbyTimer(code);
            this.clearGraceDisconnect(code, userId);
            socket.join(code);
            this.emitPresence(code, userId, true);

            const currentLobby = await this.storage.getLobbyByCode(code);
            const serialized = this.serializeLobbyForClient(currentLobby);
            const timedPayload = {
                ...serialized,
                startedAt: currentLobby?.startedAt,
                serverNow: Date.now(),
            };

            if (currentLobby?.status === 'started' && currentLobby.startedAt) {
                socket.emit(LobbyEvents.LOBBY_STARTED, timedPayload);
            } else if (currentLobby?.status === 'starting' && currentLobby.startedAt) {
                socket.emit(LobbyEvents.LOBBY_STARTING, timedPayload);
                socket.emit(LobbyEventAliases.STARTING, timedPayload);
            }

            const state = await this.emitLobbyState(code);
            return { ok: true, state };
        });
    }

    async startLobby(socket: Socket, dto: StartLobbyDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.getLobbyOrThrow(code);

            if (this.normalizeUserId(lobby.hostUserId) !== this.normalizeUserId(user.id)) {
                throw new CustomError('Only host can start', 403, 'NOT_HOST');
            }

            if (lobby.status !== 'waiting') {
                throw new CustomError('Lobby already started', 409, 'LOBBY_ALREADY_STARTED');
            }

            const members = await this.storage.listMembers(code);
            if (members.length === 0) {
                throw new CustomError('No members in lobby', 400, 'NO_MEMBERS');
            }

            const hostId = this.normalizeUserId(lobby.hostUserId);
            const nonHostMembers = members.filter(
                (member) => this.normalizeUserId(member.userId) !== hostId,
            );
            const unreadyMembers = nonHostMembers.filter((member) => !member.isReady);

            if (unreadyMembers.length > 0) {
                this.emitNotification(
                    code,
                    {
                        type: 'warning',
                        message: 'همه بازیکنان باید آماده باشند.',
                    },
                    socket.id,
                );

                const unreadyUserIds = new Set(
                    unreadyMembers.map((member) => this.normalizeUserId(member.userId)),
                );
                const roomSockets = await this.io.in(code).fetchSockets();
                const socketByUserId = new Map(
                    roomSockets.map((roomSocket) => [
                        this.normalizeUserId(roomSocket.data.user?.id),
                        roomSocket,
                    ]),
                );

                for (const uid of unreadyUserIds) {
                    const target = socketByUserId.get(uid);
                    if (target) {
                        this.emitNotification(
                            code,
                            {
                                type: 'info',
                                message: 'میزبان میخواهد شروع کند، لطفا دکمه آماده را بزنید',
                            },
                            target.id,
                        );
                    }
                }

                return { ok: false, reason: 'NOT_ALL_READY' as const };
            }

            const startedAt = Date.now() + COUNTDOWN_MS;

            await this.storage.updateLobby(code, (current) => ({
                ...current,
                status: 'starting',
                startedAt,
                joinLocked: env.WAITING_ROOM_JOIN_LOCK_ON_START,
                seq: this.nextSeq(current),
                updatedAt: Date.now(),
            }));

            const currentLobby = await this.storage.getLobbyByCode(code);
            await this.emitLobbyState(code);

            this.emitStarting(code, {
                ...this.serializeLobbyForClient(currentLobby),
                startedAt,
                serverNow: Date.now(),
            });

            this.scheduleCountdownTransition(code);
            return { ok: true as const };
        });
    }

    async leaveLobby(socket: Socket, dto: LeaveLobbyDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const userId = this.normalizeUserId(user.id);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.storage.getLobbyByCode(code);
            if (!lobby || lobby.status === 'closed') {
                socket.leave(code);
                return { code };
            }

            const member = await this.storage.getMember(code, userId);
            if (!member) {
                socket.leave(code);
                return { code };
            }

            this.clearGraceDisconnect(code, userId);
            socket.leave(code);

            if (this.isActivePlayStatus(lobby.status)) {
                await this.storage.setMember(code, {
                    ...member,
                    connected: false,
                    socketId: undefined,
                });
                this.emitPresence(code, userId, false);

                if (
                    lobby.status === 'starting' &&
                    this.normalizeUserId(lobby.hostUserId) === userId
                ) {
                    await this.cancelCountdown(code);
                }

                const members = await this.storage.listMembers(code);
                if (this.connectedCount(members) === 0) {
                    this.scheduleEmptyLobbyDestroy(code);
                    return { code };
                }

                await this.reassignHostIfNeeded(code, userId);
                await this.emitLobbyState(code);
                return { code };
            }

            await this.storage.removeMember(code, userId);
            await this.reassignHostIfNeeded(code, userId);

            const remaining = await this.storage.listMembers(code);
            if (remaining.length === 0 || this.connectedCount(remaining) === 0) {
                await this.storage.updateLobby(code, (current) => ({
                    ...current,
                    status: 'waiting',
                    joinLocked: false,
                    seq: this.nextSeq(current),
                    updatedAt: Date.now(),
                }));
                this.scheduleEmptyLobbyDestroy(code);
                return { code };
            }

            await this.emitLobbyState(code);
            return { code };
        });
    }

    async kickMember(socket: Socket, dto: KickMemberDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const targetUserId = this.normalizeUserId(dto.targetUserId);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.getLobbyOrThrow(code);

            if (this.normalizeUserId(lobby.hostUserId) !== this.normalizeUserId(user.id)) {
                throw new CustomError('Only host can kick', 403, 'NOT_HOST');
            }

            if (this.normalizeUserId(lobby.hostUserId) === targetUserId) {
                throw new CustomError('Host cannot be kicked', 400, 'CANNOT_KICK_HOST');
            }

            const targetMember = await this.storage.getMember(code, targetUserId);
            await this.storage.removeMember(code, targetUserId);
            this.clearGraceDisconnect(code, targetUserId);

            this.emitKicked(code, targetUserId);

            if (targetMember?.socketId) {
                const targetSocket = this.io.sockets.sockets.get(targetMember.socketId);
                if (targetSocket) {
                    targetSocket.leave(code);
                }
            }

            await this.storage.updateLobby(code, (current) => ({
                ...current,
                seq: this.nextSeq(current),
                updatedAt: Date.now(),
            }));

            return this.emitLobbyState(code);
        });
    }

    async destroyLobby(socket: Socket, dto: DestroyLobbyDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);

        return withLock(lobbyLockKey(code), async () => {
            const lobby = await this.getLobbyOrThrow(code);

            if (this.normalizeUserId(lobby.hostUserId) !== this.normalizeUserId(user.id)) {
                throw new CustomError('Only host can destroy', 403, 'NOT_HOST');
            }

            this.clearEmptyLobbyTimer(code);
            this.clearCountdownTimer(code);

            await this.storage.deleteLobby(code);
            await this.finishQuizIfNeeded(lobby);
            this.emitDestroyed(code, 'host');
            this.io.in(code).socketsLeave(code);
            return { code };
        });
    }

    async updateProgress(socket: Socket, dto: UpdateProgressDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const userId = this.normalizeUserId(user.id);

        const lobby = await this.getLobbyOrThrow(code);
        await this.requireMember(code, userId);

        if (lobby.status !== 'started' && lobby.status !== 'results') {
            throw new CustomError('Quiz has not started', 409, 'LOBBY_NOT_STARTED');
        }

        let answeredCount = Number(dto.answeredCount);
        if (Number.isNaN(answeredCount)) answeredCount = 0;
        answeredCount = Math.max(0, Math.min(answeredCount, lobby.questionCount));

        const existing = await this.storage.getMemberProgress(code, userId);
        if (existing?.finished) {
            return existing;
        }

        const finished =
            (dto.finished ?? false) && answeredCount >= lobby.questionCount;

        const progress: LobbyMemberProgress = {
            userId,
            answeredCount,
            finished,
            submittedAt: finished ? Date.now() : undefined,
        };

        await this.storage.setMemberProgress(code, progress);
        this.io.to(code).emit(LobbyEvents.MEMBER_PROGRESS, {
            ...progress,
            serverNow: Date.now(),
        });
        return progress;
    }

    async submitQuiz(socket: Socket, dto: SubmitQuizDto) {
        const user = socket.data.user;
        const code = this.normalizeCode(dto.code);
        const userId = this.normalizeUserId(user.id);

        return withLock(`submit:${code}:${userId}`, async () => {
            const lobby = await this.getLobbyOrThrow(code);
            await this.requireMember(code, userId);

            if (lobby.status !== 'started' && lobby.status !== 'results') {
                throw new CustomError('Quiz has not started', 409, 'LOBBY_NOT_STARTED');
            }

            const existingProgress = await this.storage.getMemberProgress(code, userId);
            if (existingProgress?.finished && existingProgress.result) {
                return existingProgress.result;
            }
            if (existingProgress?.finished) {
                throw new CustomError('Already submitted', 409, 'ALREADY_SUBMITTED');
            }

            const encodedQuizId = this.encodeStoredQuizId(lobby.quizId);
            const result = await mainBackendService.gradeQuizSubmission({
                quizId: encodedQuizId,
                userId,
                lobbyCode: code,
                answers: dto.answers,
                timeSpent: dto.timeSpent,
                questionTimes: dto.questionTimes,
                selectionLog: dto.selectionLog,
                accessToken: socket.data.accessToken,
            });

            const saveResponse = await mainBackendService.saveQuizResult({
                quizId: encodedQuizId,
                userId,
                lobbyCode: code,
                result,
                accessToken: socket.data.accessToken,
            });

            if (saveResponse?.resultId) {
                const encodedId = encodeResultId(saveResponse.resultId);
                if (encodedId) {
                    result.resultId = encodedId;
                    result.id = encodedId;
                }
            }

            await this.storage.setMemberProgress(code, {
                userId,
                answeredCount: existingProgress?.answeredCount ?? lobby.questionCount,
                finished: true,
                result,
                submittedAt: Date.now(),
            });

            this.io.to(socket.id).emit(LobbyEvents.QUIZ_RESULT, result);
            this.io.to(code).emit(LobbyEvents.MEMBER_PROGRESS, {
                userId,
                answeredCount: existingProgress?.answeredCount ?? lobby.questionCount,
                finished: true,
                submittedAt: Date.now(),
                serverNow: Date.now(),
            });

            await withLock(lobbyLockKey(code), async () => {
                const allProgress = await this.storage.listMemberProgress(code);
                const members = await this.storage.listMembers(code);
                const finishedCount = allProgress.filter((item) => item.finished).length;

                if (members.length > 0 && finishedCount === members.length) {
                    await this.storage.updateLobby(code, (current) => ({
                        ...current,
                        status: 'results',
                        resultsAt: Date.now(),
                        seq: this.nextSeq(current),
                        updatedAt: Date.now(),
                    }));

                    await this.storage.scheduleLobbyExpiry(
                        code,
                        Date.now() + env.RESULTS_TTL_SECONDS * 1000,
                    );

                    await this.finishQuizIfNeeded({
                        ...(await this.storage.getLobbyByCode(code))!,
                    });
                    await this.emitLobbyState(code);
                }
            });

            return result;
        });
    }

    async sweepExpiredLobbies(): Promise<string[]> {
        const expired = await this.storage.listExpiredLobbyCodes(Date.now());
        if (expired.length === 0) return [];

        for (const code of expired) {
            await withLock(lobbyLockKey(code), async () => {
                const lobby = await this.storage.getLobbyByCode(code);
                this.clearEmptyLobbyTimer(code);
                this.clearCountdownTimer(code);
                await this.storage.deleteLobby(code);
                await this.finishQuizIfNeeded(lobby);
                this.emitDestroyed(code, 'expired');
                this.io.in(code).socketsLeave(code);
            });
        }

        logger.info({ expired }, 'Expired lobbies cleaned');
        return expired;
    }
}

let lobbyServiceInstance: LobbyService | null = null;

export function getLobbyService(io: Server): LobbyService {
    if (!lobbyServiceInstance) {
        lobbyServiceInstance = new LobbyService(io);
    } else {
        lobbyServiceInstance.attachIo(io);
    }
    return lobbyServiceInstance;
}
