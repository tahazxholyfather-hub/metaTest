import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, LogOut, Trophy, Clock, Activity,
    Globe, Play, Share2, Crown, Copy, Check, Target, Star, Sparkles, CheckCircle2, Clock3
} from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveModal } from '../components/ResponsiveModal';
import { flowApi } from '../lib/authApi';
import { useUser } from '../context/UserContext';
import { QuizCountdown } from '../components/QuizCountdown';
import {
    encodeQuizId,
    decodeQuizId,
    encodeResultId,
    decodeResultId,
    encodeShareCode,
    decodeShareCode,
} from '../utils/hash';
import { useSocket } from '../socket/useSocket';
import { useLobbyEvents } from '../socket/useLobbyEvents';
import {
    joinLobby,
    rejoinLobby,
    startLobby,
    leaveLobby,
    kickMember,
    setReady,
} from '../socket/lobby.socket';

import type {
    LobbyState,
    LobbyMember,
    LobbyErrorEvent
} from '../socket/types';

export interface LobbyUser {
    id: string | number;
    name: string;
    socketId: string;
    avatar?: string | null;
    trophies: number;
    isMe?: boolean;
    online?: boolean;
    isHost?: boolean;
    isReady?: boolean;
    accuracy?: number;
    level?: number;
    trophy?: number;
}

const mapLobbyMemberToUser = (
    member: LobbyMember,
    state: LobbyState
): LobbyUser => {
    const mUserId = member.userId;
    const hostId = state.lobby?.hostUserId;
    const isHost = String(hostId) === String(mUserId);

    return {
        id: member.userId,
        name: member.displayName || member.username,
        socketId: member.socketId,
        avatar: member.avatarUrl,
        trophies: member.trophies,
        isHost,
        online: member.connected,
        isReady: member.isReady ?? member.ready ?? false,
    };
};

export const LobbyView: React.FC = () => {
    const { shareCode } = useParams<{ shareCode: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useUser();

    const {
        socket,
        isConnected,
        error: socketConnectionError,
    } = useSocket();

    // 'joining' blocks UI until we have a confirmed join/rejoin ack
    const [joinState, setJoinState] = useState<'joining' | 'joined' | 'error'>('joining');

    const [currentScreen, setCurrentScreen] = useState<'lobby' | 'countdown'>('lobby');
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
    const [lobbyError, setLobbyError] = useState<string | null>(null);
    const [quizData, setQuizData] = useState<any>(null);
    const [countdownStartedAt, setCountdownStartedAt] = useState<string | number | Date | null>(null);
    const [isMeReady, setIsMeReady] = useState(false);
    // Track whether countdown was triggered by 'starting' (not yet fully started)
    const [isStarting, setIsStarting] = useState(false);
    const [serverOffset, setServerOffset] = useState(0);

    const [fetchedData, setFetchedData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [userToKick, setUserToKick] = useState<LobbyUser | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const readyCount = lobbyUsers.filter(u => !u.isHost && u.isReady).length;
    const totalPlayers = lobbyUsers.filter(u => !u.isHost).length;

    const hasRedirectedToQuiz = useRef(false);
    const lobbyUsersRef = useRef<LobbyUser[]>([]);
    const fetchedDataRef = useRef<any>(null);
    const quizDataRef = useRef<any>(null);
    // Track whether we have existing lobby state (for rejoin detection)
    const hasLobbyStateRef = useRef(false);

    const shareLink = `${window.location.origin}/join/${shareCode}`;

    useEffect(() => {
        lobbyUsersRef.current = lobbyUsers;
    }, [lobbyUsers]);

    useEffect(() => {
        fetchedDataRef.current = fetchedData;
    }, [fetchedData]);

    useEffect(() => {
        quizDataRef.current = quizData;
    }, [quizData]);

    const activeError = useMemo(() => {
        return lobbyError || socketConnectionError || error || null;
    }, [lobbyError, socketConnectionError, error]);

    const redirectToQuiz = useCallback((payload?: any) => {
        const mergedData = {
            ...(fetchedDataRef.current || {}),
            ...(quizDataRef.current || {}),
            ...(payload || {}),
        };

        const quizId =
            mergedData?.id ||
            mergedData?.quizId ||
            mergedData?.lobby?.quizId;

        if (!quizId || hasRedirectedToQuiz.current) return;

        hasRedirectedToQuiz.current = true;

        const users = lobbyUsersRef.current || [];
        const isHost = Boolean(
            users.find((u) => String(u.id) === String(currentUser?.id))?.isHost
        );

        navigate(`/quiz/${quizId}`, {
            replace: true,
            state: {
                fromLobby: true,
                shareCode,
                lobbyUsers: users,
                quizData: mergedData,
                isHost,
            }
        });
    }, [navigate, shareCode, currentUser?.id]);

    const applyLobbyState = useCallback((state: LobbyState) => {
        if (!state || !state.lobby) return;
        setJoinState('joined'); // ✅ ADD THIS
        setLobbyState(state);
        hasLobbyStateRef.current = true;

        if (state.members) {
            const mappedUsers = state.members.map((member) => mapLobbyMemberToUser(member, state));
            setLobbyUsers(mappedUsers);
            lobbyUsersRef.current = mappedUsers;

            const me = state.members.find(m => String(m.userId) === String(currentUser?.id));
            if (me) {
                setIsMeReady(!!me.isReady);
            }
        }

        const nextQuizData = {
            ...(quizDataRef.current || {}),
            ...state.lobby,
            questionCount: state.lobby.questionCount,
            maxMembers: state.lobby.maxMembers,
            status: state.lobby.status,
        };

        quizDataRef.current = nextQuizData;
        setQuizData(nextQuizData);

        setLobbyError(null);
        setIsLoading(false);

        // Handle server-side status for reconnects:
        if (state.lobby.status === 'waiting') {
            setIsStarting(false);
            setCurrentScreen('lobby');
            setCountdownStartedAt(null);
        }

        if (state.lobby.status === 'starting') {
            const startedAt = state.lobby.startedAt || null;
            setIsStarting(true);
            setCountdownStartedAt(startedAt);
            setCurrentScreen('countdown');
        }

        // If we reconnect and lobby is already 'started', go straight to quiz redirect
        if (state.lobby.status === 'started') {
            const startedAt = state.lobby.startedAt || null;
            setIsStarting(false);
            setCountdownStartedAt(startedAt);
            setCurrentScreen('countdown');
        }
    }, [currentUser?.id]);

    const handleLobbyError = useCallback((err: LobbyErrorEvent) => {
        const errorMsg = err.message || 'خطای دریافت رویدادهای اتاق';
        setLobbyError(errorMsg);
        setIsLoading(false);
        toast.error(errorMsg);
    }, []);

    useLobbyEvents({
        socket,

        onLobbyState: applyLobbyState,

        // Fix #1: Handle LOBBY_STARTING — server transitions waiting → starting
        onLobbyStarting: (data) => {
            setJoinState('joined'); // ✅ ADD THIS
            const startedAt = data?.startedAt || data?.startAt || null;
            const serverNow = data?.serverNow ?? Date.now();

            const offset = serverNow - Date.now();
            setServerOffset(offset);

            const updated = {
                ...(quizDataRef.current || {}),
                ...data,
                status: 'starting',
                startedAt,
            };

            quizDataRef.current = updated;
            setQuizData(updated);

            setIsStarting(true);
            setCountdownStartedAt(startedAt);
            setCurrentScreen('countdown');
        },


        onLobbyStarted: (data) => {
            const startedAt =
                data?.startedAt ||
                data?.startAt ||
                data?.started_at ||
                null;

            const updated = {
                ...(quizDataRef.current || {}),
                ...data,
                status: 'started',
                startedAt,
            };

            quizDataRef.current = updated;
            setQuizData(updated);

            setIsStarting(false);
            setCountdownStartedAt(startedAt);
            setCurrentScreen('countdown');
            redirectToQuiz({
                ...updated,
                startedAt,
                status: 'started',
            });
        },

        // Fix #2: Handle LOBBY_CANCELLED — host disconnected during countdown
        onLobbyCancelled: () => {
            setIsStarting(false);
            setCurrentScreen('lobby');
            setCountdownStartedAt(null);

            const updated = {
                ...(quizDataRef.current || {}),
                status: 'waiting',
            };
            quizDataRef.current = updated;
            setQuizData(updated);

            toast.warning('شمارش معکوس لغو شد. میزبان قطع شد.');
        },

        onMemberJoined: applyLobbyState,
        onMemberLeft: applyLobbyState,
        onMemberUpdated: applyLobbyState,
        onMemberProgress: (payload) => {
            if ('members' in payload && 'lobby' in payload) {
                applyLobbyState(payload);
            }
        },

        onLobbyDestroyed: () => {
            toast.error('اتاق توسط میزبان بسته شد.');
            navigate('/');
        },

        onKicked: (payload) => {
            const currentUserId = currentUser?.id;

            if (!payload.userId || String(payload.userId) === String(currentUserId)) {
                toast.error('شما از اتاق اخراج شدید.');
                navigate('/');
                return;
            }

            toast.info('یکی از کاربران از اتاق اخراج شد.');
        },

        onQuizResult: () => {},
        onLobbyError: handleLobbyError,
        onNotification: (data) => {
            if (data.type === 'warning') toast.warning(data.message);
            else if (data.type === 'error') toast.error(data.message);
            else if (data.type === 'success') toast.success(data.message);
            else toast.info(data.message);
        },
    });

    // Fix #5: Use rejoinLobby on reconnect, joinLobby only on first mount.
    // Blocks UI (joinState = 'joining') until ack is received.
    useEffect(() => {
        if (!shareCode || !socket || !isConnected) return;

        let mounted = true;

        const doJoin = async () => {
            setJoinState('joining');

            try {
                // If we already have lobby state, this is a reconnect — use rejoinLobby
                if (hasLobbyStateRef.current) {
                    const result = await rejoinLobby(socket, { code: shareCode });
                    if (!mounted) return;

                    if (!result.ok) {
                        if (result.reason === 'NOT_A_MEMBER') {
                            toast.error('شما عضو این اتاق نیستید.');
                            navigate('/');
                            return;
                        }
                        if (result.reason === 'LOBBY_NOT_FOUND') {
                            setLobbyError('اتاق یافت نشد');
                            setJoinState('error');
                            return;
                        }
                        setLobbyError(result.reason || 'خطا در اتصال مجدد');
                        setJoinState('error');
                        return;
                    }

                    if (result.state) applyLobbyState(result.state);
                    setJoinState('joined');
                    return;
                }

                // First-time join
                const state = await joinLobby(socket, { code: shareCode });
                if (!mounted) return;

                applyLobbyState(state);
                setJoinState('joined');
            } catch (err: any) {
                if (!mounted) return;

                const msg = err?.message || 'خطا در ورود به اتاق';
                setLobbyError(msg);
                setIsLoading(false);
                setJoinState('error');
                toast.error(msg);
            }
        };

        doJoin();

        return () => {
            mounted = false;
        };
    }, [socket, isConnected, shareCode]);  // intentionally excludes applyLobbyState to avoid re-runs

    useEffect(() => {
        if (fetchedData || !shareCode) {
            if (fetchedData) setIsLoading(false);
            return;
        }

        const fetchMissingQuizData = async () => {
            try {
                const res = await flowApi.dispatch('get_quiz_by_share_code', { shareCode });

                if (res && res.success) {
                    setFetchedData(res);
                } else {
                    setError(res?.message || 'خطا در دریافت اطلاعات آزمون');
                }
            } catch {
                setError('خطا در ارتباط با سرور');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMissingQuizData();
    }, [shareCode, fetchedData]);

    const handleToggleReady = () => {
        const newReadyState = !isMeReady;
        setIsMeReady(newReadyState);

        if (socket && shareCode) {
            void setReady(socket, {
                code: shareCode,
                isReady: newReadyState,
            }).catch((err: { message?: string }) => {
                setIsMeReady(!newReadyState);
                toast.error(err?.message || 'خطا در تغییر وضعیت آماده');
            });
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareLink);
        setIsCopied(true);
        toast.success('لینک اتاق کپی شد');
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Fix #4: Don't treat kickMember response as authoritative state.
    // Rely on the broadcasted LOBBY_STATE event via onMemberLeft/onLobbyState.
    const handleKickUser = async (userId: string | number) => {
        if (!socket || !shareCode) return;

        try {
            await kickMember(socket, {
                code: shareCode,
                targetUserId: String(userId),
                userId: String(userId),
            });
            toast.success('کاربر با موفقیت اخراج شد');
        } catch (err: any) {
            toast.error(err?.message || 'خطا در اخراج کاربر');
        } finally {
            setUserToKick(null);
        }
    };

    // Fix #3: startLobby now returns { ok, reason } — not a lobby state.
    // Don't call applyLobbyState here. The LOBBY_STARTING event will update the UI.
    const handleStartQuiz = async () => {
        if (!socket || !shareCode) return;

        try {
            const result = await startLobby(socket, { code: shareCode });

            if (result?.ok === false) {
                if (result.reason === 'NOT_ALL_READY') {
                    toast.warning('همه بازیکنان باید آماده باشند.');
                } else {
                    toast.error(result.reason || 'خطا در شروع آزمون');
                }
                return;
            }

            // Success: server will emit LOBBY_STARTING → onLobbyStarting handles the UI transition
            setIsStartOpen(false);
        } catch (err: any) {
            toast.error(err?.message || 'خطا در شروع آزمون');
        }
    };

    const handleLeave = async () => {
        if (isLeaving) return;

        try {
            setIsLeaving(true);

            if (socket && shareCode) {
                await leaveLobby(socket, { code: shareCode });
            }

            navigate('/');
        } catch (e) {
            console.error('Leave lobby error:', e);
            navigate('/');
        } finally {
            setIsLeaving(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
    };

    const currentData = { ...fetchedData, ...quizData };

    const isMeHost = Boolean(
        lobbyUsers.find((u) => String(u.id) === String(currentUser?.id))?.isHost
    );

    const allSelections = [
        ...(currentData?.lessons || []),
        ...(currentData?.grades || []),
        ...(currentData?.chapters || currentData?.mabhas || []),
    ];

    // Fix #7: Derive isStarting from either local state or server-reported status
    const lobbyIsStarting =
        isStarting || currentData?.status === 'starting';

    // --- Render: error ---
    if (activeError && joinState !== 'joining') {
        return (
            <div dir="rtl" className="min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                    <h2 className="text-lg font-extrabold text-red-500 mb-3">
                        خطا در اتاق انتظار
                    </h2>
                    <p className="text-sm font-bold text-red-500 mb-6">{activeError}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm"
                    >
                        بازگشت به داشبورد
                    </button>
                </div>
            </div>
        );
    }

    // --- Render: countdown screen ---
    if (currentScreen === 'countdown') {
        const startAt =
            countdownStartedAt ||
            quizData?.startedAt ||
            quizData?.startAt ||
            quizData?.started_at ||
            currentData?.startedAt ||
            currentData?.startAt ||
            currentData?.started_at;

        return (
            <QuizCountdown
                startAt={startAt}
                serverOffset={serverOffset}
                onComplete={() => {
                    // Only redirect when the quiz is actually started (not just 'starting')
                    // If status is still 'starting', wait for LOBBY_STARTED event
                    if (!lobbyIsStarting || currentData?.status === 'started') {
                        redirectToQuiz({
                            ...currentData,
                            startedAt: startAt,
                            status: 'started',
                        });
                    }
                }}
            />
        );
    }

    // --- Render: initial loading / joining spinner ---
    if (joinState === 'joining' || (isLoading && !currentData.quizId && !currentData.quizName && !currentData.id)) {
        return (
            <div dir="rtl" className="flex flex-col items-center justify-center min-h-screen text-[var(--accent)] gap-3">
                <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold">در حال همگام‌سازی با اتاق...</p>
            </div>
        );
    }

    // --- Render: lobby ---
    return (
        <div dir="rtl" className="relative p-4 flex flex-col w-full min-h-screen md:max-w-7xl md:mx-auto md:px-8 md:py-10">
            {/* Header */}
            <div className="flex flex-row justify-between items-center mb-6 mt-2 gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center p-2 sm:p-2.5 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                        <Users size={20} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                            اتاق انتظار
                        </h2>
                        <p className="text-[var(--text-secondary)] text-[10px] sm:text-xs font-medium flex items-center gap-1 mt-0.5 truncate">
                            کد اتاق:
                            <span className="font-black text-[15px] text-[var(--primary)] tracking-wide relative overflow-hidden inline-block shimmer-code">
                                {decodeShareCode(shareCode)}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                        onClick={() => setIsLeaveOpen(true)}
                        disabled={lobbyIsStarting}
                        className="flex items-center justify-center p-2 sm:p-2.5 rounded-xl border border-[var(--border)] text-red-500 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="خروج"
                    >
                        <LogOut size={20} />
                    </button>

                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="flex items-center justify-center p-2 sm:p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-element)] transition-colors shrink-0"
                        title="اشتراک‌گذاری"
                    >
                        <Share2 size={20} />
                    </button>

                    {/* Fix #7: Disable start button during 'starting' countdown */}
                    {isMeHost && (
                        <button
                            onClick={() => setIsStartOpen(true)}
                            disabled={lobbyIsStarting}
                            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            <Play size={16} fill="currentColor" />
                            شروع
                        </button>
                    )}
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="flex flex-col p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-element)]/50">
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                        <Activity size={16} />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">نام آزمون</span>
                    </div>
                    <span
                        className="text-sm font-bold text-[var(--text-primary)] truncate"
                        title={currentData?.quizName || currentData?.title || 'بدون نام'}
                    >
                        {currentData?.quizName || currentData?.title || 'بدون نام'}
                    </span>
                </div>

                <div className="flex flex-col p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-element)]/50">
                    <div className="flex items-center gap-2 mb-2 text-orange-500">
                        <Clock size={16} />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">زمان</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                        {currentData?.settings?.time || 'نامشخص'} دقیقه
                    </span>
                </div>

                {/* Fix #6: Show 'starting' status */}
                <div className="flex flex-col p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-element)]/50">
                    <div className="flex items-center gap-2 mb-2 text-purple-500">
                        <Globe size={16} />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">وضعیت</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                        {currentData?.status === 'waiting'
                            ? 'در انتظار'
                            : currentData?.status === 'starting'
                                ? 'در حال شروع...'
                                : currentData?.status === 'started'
                                    ? 'شروع شده'
                                    : 'در انتظار'}
                    </span>
                </div>

                <div className="flex flex-col p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-element)]/50">
                    <div className="flex items-center gap-2 mb-2 text-emerald-500">
                        <Users size={16} />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">ظرفیت</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                        {lobbyUsers.length} / {currentData?.maxMembers || currentData?.settings?.memberLimit || 50}
                    </span>
                </div>
            </div>

            {/* Topic tags */}
            <div className="mb-8">
                {allSelections.length > 0 ? (
                    <div className="flex overflow-x-auto gap-2 items-center [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden py-1">
                        {allSelections.map((item: any, idx: number) => {
                            const label =
                                typeof item === 'object'
                                    ? item.name || item.title || `مورد ${idx + 1}`
                                    : item;

                            return (
                                <span
                                    key={item?.id || idx}
                                    className="px-4 py-2 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-bold whitespace-nowrap shrink-0 transition-colors bg-[var(--accent)]/5"
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <span className="text-xs text-[var(--text-muted)] italic">آیتمی انتخاب نشده است</span>
                )}
            </div>

            {/* Participants header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    شرکت‌کنندگان ({lobbyUsers.length})
                </h3>
                <div className="text-xs font-bold text-[var(--text-secondary)]">
                    آمادگی بازیکنان: {readyCount} / {totalPlayers}
                </div>
            </div>

            {/* Participant cards */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                <AnimatePresence>
                    {lobbyUsers.map((user) => {
                        const isMe = String(user.id) === String(currentUser?.id);

                        return (
                            <motion.div
                                variants={itemVariants}
                                key={user.socketId}
                                onClick={() => {
                                    if (isMeHost && !isMe && !lobbyIsStarting) setUserToKick(user);
                                }}
                                initial="hidden"
                                animate="show"
                                exit="hidden"
                                className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-200
                                    ${isMe
                                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm'
                                    : 'border-[var(--border)] bg-[var(--surface)]/50 hover:bg-[var(--surface)]/80'
                                }
                                    ${isMeHost && !isMe && !lobbyIsStarting ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'}
                                `}
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="relative shrink-0">
                                        <div
                                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden flex items-center justify-center bg-[var(--bg-element)] transition-shadow
                                                ${isMe
                                                ? 'ring-2 ring-offset-2 ring-offset-[var(--background)] ring-[var(--accent)]'
                                                : 'border border-[var(--border)]'
                                            }`}
                                        >
                                            {user.avatar ? (
                                                <img
                                                    src={user.avatar}
                                                    alt={user.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Users size={18} className="text-[var(--text-muted)]" />
                                            )}
                                        </div>

                                        <span
                                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[var(--background)] transition-colors
                                                ${user.online !== false ? 'bg-emerald-500' : 'bg-gray-400'}`}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                            <span className="font-semibold text-sm sm:text-base text-[var(--text-primary)] truncate max-w-[140px]">
                                                {user.name}
                                            </span>

                                            {user.isHost && (
                                                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-500/10 border border-amber-500/20">
                                                    <Crown size={12} className="text-amber-500" />
                                                    میزبان
                                                </span>
                                            )}

                                            {isMe && (
                                                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                                                    <Sparkles size={12} />
                                                    شما
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-0.5 text-xs text-[var(--text-muted)] font-medium">
                                            {user.online !== false ? 'آنلاین' : 'آفلاین'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 shrink-0 ms-auto">
                                    {!user.isHost && (
                                        isMe ? (
                                            // Fix #7: Disable ready toggle during countdown
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!lobbyIsStarting) handleToggleReady();
                                                }}
                                                disabled={lobbyIsStarting}
                                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                                                    ${isMeReady
                                                    ? 'text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/25'
                                                    : 'text-[var(--text-secondary)] bg-[var(--bg-element)] border border-[var(--border)] hover:bg-[var(--border)]'
                                                }`}
                                            >
                                                <CheckCircle2
                                                    size={14}
                                                    className={isMeReady ? 'text-emerald-600' : 'text-[var(--text-muted)]'}
                                                />
                                                {isMeReady ? 'آماده' : 'آماده شو'}
                                            </button>
                                        ) : (
                                            <div
                                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium
                                                    ${user.isReady
                                                    ? 'text-emerald-700 bg-emerald-500/10'
                                                    : 'text-gray-500 bg-gray-500/10'
                                                }`}
                                            >
                                                {user.isReady ? (
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                ) : (
                                                    <Clock3 size={14} className="text-gray-400" />
                                                )}
                                                {user.isReady ? 'آماده' : 'منتظر'}
                                            </div>
                                        )
                                    )}

                                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] px-1">
                                        <Trophy size={14} className="text-yellow-500 drop-shadow-sm" />
                                        <span className="text-xs font-semibold tabular-nums">{user.trophies || 0}</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>

            {/* Kick modal */}
            <ResponsiveModal isOpen={!!userToKick} onClose={() => setUserToKick(null)} title="اخراج بازیکن">
                {userToKick && (
                    <div className="flex flex-col items-center text-center mt-2">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--border)] mb-3 bg-[var(--bg-element)] flex items-center justify-center">
                            {userToKick.avatar ? (
                                <img src={userToKick.avatar} alt={userToKick.name} className="w-full h-full object-cover" />
                            ) : (
                                <Users size={32} className="text-[var(--text-muted)]" />
                            )}
                        </div>

                        <h4 className="font-bold text-base text-[var(--text-primary)] mb-4">{userToKick.name}</h4>

                        <div className="flex items-center justify-center gap-6 w-full p-4 bg-[var(--bg-element)] rounded-2xl border border-[var(--border)] mb-6">
                            <div className="flex flex-col items-center gap-1.5">
                                <Target size={18} className="text-blue-500" />
                                <span className="text-xs font-bold text-[var(--text-primary)]">{userToKick.accuracy || 0}%</span>
                                <span className="text-[10px] text-[var(--text-muted)]">دقت</span>
                            </div>
                            <div className="w-px h-8 bg-[var(--border)]" />
                            <div className="flex flex-col items-center gap-1.5">
                                <Star size={18} className="text-orange-500" />
                                <span className="text-xs font-bold text-[var(--text-primary)]">سطح {userToKick.level || 0}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">تجربه</span>
                            </div>
                            <div className="w-px h-8 bg-[var(--border)]" />
                            <div className="flex flex-col items-center gap-1.5">
                                <Trophy size={18} className="text-yellow-500" />
                                <span className="text-xs font-bold text-[var(--text-primary)]">{userToKick.trophy || 0}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">کاپ</span>
                            </div>
                        </div>

                        <p className="text-sm text-[var(--text-secondary)] mb-6">
                            آیا مطمئن هستید که می‌خواهید{' '}
                            <span className="font-bold text-[var(--text-primary)]">{userToKick.name}</span>{' '}
                            را از اتاق اخراج کنید؟
                        </p>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setUserToKick(null)}
                                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-bold text-sm transition-colors hover:bg-[var(--bg-element)]"
                            >
                                انصراف
                            </button>
                            <button
                                onClick={() => handleKickUser(userToKick.id)}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
                            >
                                اخراج بازیکن
                            </button>
                        </div>
                    </div>
                )}
            </ResponsiveModal>

            {/* Leave modal */}
            <ResponsiveModal isOpen={isLeaveOpen} onClose={() => !isLeaving && setIsLeaveOpen(false)} title="خروج از اتاق">
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                    آیا مطمئن هستید که می‌خواهید از اتاق انتظار خارج شوید؟
                </p>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={() => setIsLeaveOpen(false)}
                        disabled={isLeaving}
                        className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-bold text-sm disabled:opacity-50"
                    >
                        انصراف
                    </button>
                    <button
                        onClick={handleLeave}
                        disabled={isLeaving}
                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLeaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                                در حال خروج...
                            </>
                        ) : (
                            'خروج'
                        )}
                    </button>
                </div>
            </ResponsiveModal>

            {/* Share modal */}
            <ResponsiveModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} title="اشتراک‌گذاری">
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                    لینک زیر را برای دعوت دوستان خود کپی کنید:
                </p>
                <div className="flex items-center gap-2 p-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-element)] mb-6">
                    <input
                        type="text"
                        readOnly
                        value={shareLink}
                        className="flex-1 bg-transparent text-sm text-left text-[var(--text-primary)] px-2 outline-none w-full min-w-0"
                        dir="ltr"
                    />
                    <button
                        onClick={handleCopy}
                        className={`flex items-center justify-center w-10 h-10 rounded-lg text-white transition-all shrink-0 ${isCopied ? 'bg-emerald-500' : 'bg-[var(--accent)]'}`}
                    >
                        {isCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
                <button
                    onClick={() => setIsShareOpen(false)}
                    className="w-full py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-bold text-sm"
                >
                    بستن
                </button>
            </ResponsiveModal>

            {/* Start modal */}
            <ResponsiveModal isOpen={isStartOpen} onClose={() => setIsStartOpen(false)} title="شروع رقابت">
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                    آیا می‌خواهید آزمون را برای همه شرکت‌کنندگان شروع کنید؟
                </p>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={() => setIsStartOpen(false)}
                        className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-bold text-sm"
                    >
                        انصراف
                    </button>
                    <button
                        onClick={handleStartQuiz}
                        className="flex-1 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold text-sm transition-colors"
                    >
                        شروع آزمون
                    </button>
                </div>
            </ResponsiveModal>
        </div>
    );
};
