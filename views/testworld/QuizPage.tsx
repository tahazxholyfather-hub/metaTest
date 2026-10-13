import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import { MathRenderer } from '../../components/ui/MathRenderer';
import { QuestionCounter } from '../../components/QuestionCounter';
import { CountdownTimer } from '../../components/QuizTimerCountDown';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import { flowApi } from '../../lib/authApi';
import { useUser } from '../../context/UserContext';
import { useSocket } from '../../socket/useSocket';
import { useLobbyEvents } from '../../socket/useLobbyEvents';
import {
    joinLobby,
    rejoinLobby,
    submitQuiz,
    updateMemberProgress,
    SocketRequestError,
} from '../../socket/lobby.socket';
import type { LobbyState, QuizResult } from '../../socket/types';

// ─── Avatar Progress Sub-Components ──────────────────────────────────────────

interface AvatarData {
    id: string | number;
    imageUrl: string;
    name: string;
    progress: number; // 0–100
}

interface AvatarWithProgressProps {
    avatar: AvatarData;
    size?: number;
    strokeWidth?: number;
}

const AvatarWithProgress: React.FC<AvatarWithProgressProps> = ({
                                                                   avatar,
                                                                   size = 46,
                                                                   strokeWidth = 2,
                                                               }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (avatar.progress / 100) * circumference;
    const isCompleted = avatar.progress === 100;

    return (
        <div className="relative flex flex-col items-center shrink-0 select-none animate-none">
            <div className="relative flex items-center justify-center animate-none" style={{ width: size, height: size }}>
                <svg
                    className="absolute top-0 left-0 -rotate-90 animate-none"
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                >
                    <circle
                        className="text-zinc-200 dark:text-zinc-800"
                        strokeWidth={strokeWidth}
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                    />
                    <motion.circle
                        className="text-[var(--accent)]"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                    />
                </svg>

                <div
                    className="rounded-full overflow-hidden border-2 border-transparent"
                    style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}
                >
                    <img
                        src={avatar.imageUrl}
                        alt={avatar.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                </div>

                {isCompleted && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--success)] border-2 border-white dark:border-zinc-900 flex items-center justify-center text-white">
                        <Check size={8} strokeWidth={4} />
                    </div>
                )}
            </div>
            <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 mt-1 truncate text-center select-none w-14">
                {avatar.name}
            </span>
        </div>
    );
};

const AvatarList: React.FC<{ avatars: AvatarData[] }> = ({ avatars }) => (
    <div className="w-full">
        <div className="flex items-center gap-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {avatars.map((avatar) => (
                <AvatarWithProgress key={avatar.id} avatar={avatar} size={46} strokeWidth={2} />
            ))}
        </div>
    </div>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { id: number; text: string; subject_id?: number };

type Question = {
    id: number;
    text: string;
    options: Option[];
    subject: string;
    subject_id?: number;
    grade?: string;
    topic?: string;
    chapter?: string;
    level: string;
    has_image?: boolean;
    image_url?: string | null;
    correct_option_id?: number;
    descriptive_answer?: string;
    points_earned?: number;
};

type SelectionLog = {
    questionId: number;
    optionId: number;
    timeSpentMs: number;
    timestamp: number;
};

type StoredQuizSession = {
    quizId: string;
    userId: string | number;
    answers: Record<number, number>;
    questionTimes: Record<number, number>;
    selectionLog: SelectionLog[];
    quizStartEpoch: number;
    deadlineEpoch: number;
    expiresAt: number;
    activeFilter: string;
    scrollPosition: number;
    lobbyState: LobbyState | null;
    hasSubmitted?: boolean;
};

interface QuizPageProps {
    quizData?: any;
    onExit?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const butteryEase = [0.22, 1, 0.36, 1];

const decodeHtmlEntities = (text: string) => {
    if (!text) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = text;
    return txt.value
        .replace(/\u200c|\u200d|\u200e|\u200f|\ufeff/g, '')
        .replace(/&zwnj;|&zwj;|&lrm;|&rlm;|&nbsp;/gi, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
};

function getErrorMessage(err: unknown, fallback = 'خطای نامشخص رخ داد.') {
    if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
        return (err as any).message;
    }
    return fallback;
}

function isTruthyMemberResponse(response: any): boolean {
    return Boolean(
        response?.isMember ?? response?.data?.isMember ?? response?.result?.isMember ??
        response?.member ?? response?.data?.member ?? response?.success,
    );
}

function getLobbyMembers(lobbyState: any): any[] {
    if (Array.isArray(lobbyState?.members)) return lobbyState.members;
    if (Array.isArray(lobbyState?.data?.members)) return lobbyState.data.members;
    return [];
}

function isUserInsideLobbyMembers(lobbyState: any, userId: string | number): boolean {
    return getLobbyMembers(lobbyState).some(
        (m) => String(m?.userId) === String(userId) || String(m?.id) === String(userId) || String(m?.user?.id) === String(userId),
    );
}

function getLobbyStatus(lobbyState: any): string {
    return String(lobbyState?.status ?? lobbyState?.data?.status ?? '').toLowerCase();
}

function getLobbyJoinLocked(lobbyState: any): boolean {
    return Boolean(lobbyState?.joinLocked ?? lobbyState?.data?.joinLocked);
}

function getLobbyCodeFromQuizData(quizData: any, fallback: string): string {
    return String(quizData?.code ?? quizData?.lobbyCode ?? quizData?.lobby?.code ?? fallback);
}

function validateLobbyAccess(lobbyState: any, currentUserId: string | number): string | null {
    const status = getLobbyStatus(lobbyState);
    const joinLocked = getLobbyJoinLocked(lobbyState);
    const isInMembers = isUserInsideLobbyMembers(lobbyState, currentUserId);
    const closedStatuses = ['closed', 'ended', 'finished', 'expired', 'destroyed'];
    if (closedStatuses.includes(status)) return 'لابی این آزمون بسته شده یا آزمون به پایان رسیده است.';
    if (status === 'started' && !isInMembers) return 'آزمون شروع شده است و امکان ورود جدید وجود ندارد.';
    if (joinLocked && !isInMembers) return 'ورود به لابی قفل شده است.';
    return null;
}

const ensureSocketConnected = (sock: any): Promise<boolean> => {
    if (!sock) return Promise.resolve(false);
    if (sock.connected) return Promise.resolve(true);
    return new Promise((resolve) => {
        const cleanup = () => {
            sock.off('connect', onConnect);
            sock.off('connect_error', onError);
        };
        const onConnect = () => { cleanup(); resolve(true); };
        const onError = () => { cleanup(); resolve(false); };
        sock.on('connect', onConnect);
        sock.on('connect_error', onError);
        setTimeout(() => { cleanup(); resolve(sock.connected); }, 5000);
    });
};

function normalizeQuestion(q: any): Question {
    let subId: number | null = null;
    if (q.subject_id != null) subId = Number(q.subject_id);
    else if (q.subjectId != null) subId = Number(q.subjectId);
    else if (q.subject && typeof q.subject === 'object' && q.subject.id != null) subId = Number(q.subject.id);
    else if (q.category_id != null) subId = Number(q.category_id);
    else if (q.categoryId != null) subId = Number(q.categoryId);

    let subName = 'درس';
    if (typeof q.subject === 'string') subName = q.subject;
    else if (q.subject && typeof q.subject === 'object' && typeof q.subject.name === 'string') subName = q.subject.name;
    else if (typeof q.subject_name === 'string') subName = q.subject_name;
    else if (typeof q.subjectName === 'string') subName = q.subjectName;
    else if (q.category && typeof q.category === 'object' && typeof q.category.name === 'string') subName = q.category.name;

    if (subId === null || isNaN(subId)) {
        let hash = 0;
        for (let i = 0; i < subName.length; i++) hash = subName.charCodeAt(i) + ((hash << 5) - hash);
        subId = Math.abs(hash);
    }

    return {
        id: q.id,
        text: decodeHtmlEntities(q.text || ''),
        level: q.difficulty_level || q.level || '',
        subject_id: subId,
        subject: subName,
        grade: q.grade,
        topic: q.topic,
        chapter: q.chapter,
        options: q.options || [],
        has_image: q.has_image,
        image_url: q.images?.length ? q.images[0] : (q.image_url || null),
    };
}

function checkAlreadySubmitted(res: any): { isAlreadySub: boolean; resId: string | null } {
    const resId: string | null =
        res?.resultId ?? res?.result_id ?? res?.data?.resultId ?? res?.data?.result_id ?? res?.result?.id ?? null;
    const isAlreadySub =
        (res?.success === true && resId !== null) ||
        res?.alreadySubmitted === true || res?.already_submitted === true ||
        res?.submitted === true || res?.is_submitted === true || res?.isSubmitted === true ||
        (!res?.success && (
            String(res?.message || '').toLowerCase().includes('submitted') ||
            String(res?.message || '').toLowerCase().includes('قبلاً شرکت کرده‌اید') ||
            String(res?.message || '').toLowerCase().includes('قبلاً ثبت شده')
        ));
    return { isAlreadySub, resId };
}

function FilterPill({ prefix, active, onClick, label }: { prefix: string; active: boolean; onClick: () => void; label: string }) {
    return (
        <button onClick={onClick} className="relative px-4 py-1.5 text-sm font-semibold transition-colors shrink-0 whitespace-nowrap">
            {active && (
                <motion.div layoutId={`${prefix}-activeFilterPill`} className="absolute inset-0 bg-[var(--accent)] rounded-full" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <span className={`relative z-10 transition-colors ${active ? 'text-white' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
                {label}
            </span>
        </button>
    );
}

function Skeleton({ className }: { className?: string }) {
    return (
        <div className={`relative overflow-hidden rounded-md bg-zinc-200/80 dark:bg-zinc-800/80 ${className || ''}`}>
            <motion.div
                className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent"
                style={{ width: '150%', skewX: '-15deg' }}
                animate={{ translateX: ['-100%', '150%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: [0.4, 0.0, 0.2, 1] }}
            />
        </div>
    );
}

const FilterGroup = ({
                         prefix, activeFilter, setActiveFilter, subjects,
                     }: { prefix: string; activeFilter: string; setActiveFilter: (f: string) => void; subjects: { id: number; name: string }[] }) => (
    <>
        <FilterPill prefix={prefix} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} label="همه" />
        <FilterPill prefix={prefix} active={activeFilter === 'answered'} onClick={() => setActiveFilter('answered')} label="پاسخ داده" />
        <FilterPill prefix={prefix} active={activeFilter === 'unanswered'} onClick={() => setActiveFilter('unanswered')} label="نزده" />
        {subjects.length > 1 && (
            <>
                <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1 shrink-0" />
                {subjects.map((sub) => (
                    <FilterPill key={`sub_${sub.id}`} prefix={prefix} active={activeFilter === `sub_${sub.id}`} onClick={() => setActiveFilter(`sub_${sub.id}`)} label={sub.name} />
                ))}
            </>
        )}
    </>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuizPage({ quizData: initialQuizData, onExit }: QuizPageProps) {
    const navigate = useNavigate();
    const { quizId } = useParams();
    const hashedQuizId = quizId || '';

    const { user, isAuthenticated, isAuthLoading } = useUser();
    const currentUserId = user?.id ?? null;

    const { socket, isConnected, status: socketStatus, error: socketError, connect } = useSocket();

    // ─── Stable refs ─────────────────────────────────────────────────────────
    const hasSubmittedRef = useRef(false);
    const hasSubmittedSuccessfullyRef = useRef(false);
    const loadedQuizIdRef = useRef<string | null>(null);
    const joinedLobbyRef = useRef(false);
    const lobbyCodeRef = useRef<string | null>(null);
    const isPrivatePreviewRef = useRef(false);
    const isNavigatingAwayRef = useRef(false);

    // Absolute Unix MS when the quiz started and when it ends.
    const quizStartEpochRef = useRef<number>(0);
    const deadlineEpochRef = useRef<number>(0);

    // ─── Precise time-tracking refs ──────────────────────────────────────────
    const questionTimesRef = useRef<Record<number, number>>({});
    const selectionLogRef = useRef<SelectionLog[]>([]);
    const activeQuestionIdRef = useRef<number | null>(null);
    const lastTickTimeRef = useRef<number>(Date.now());
    const questionRefs = useRef<Record<number, HTMLElement | null>>({});

    // Focus tracking for answered questions
    const currentFocusDurationRef = useRef<number>(0);
    const lastActiveQuestionIdRef = useRef<number | null>(null);

    // Track visibility pause so time-tracking pauses while tab is hidden
    const hiddenSinceRef = useRef<number | null>(null);

    const [, setTick] = useState(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [quizData, setQuizData] = useState<any>(initialQuizData ?? null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lobbyError, setLobbyError] = useState<string | null>(null);

    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isTabWarningOpen, setIsTabWarningOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('all');

    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
    const [isSessionReady, setIsSessionReady] = useState<boolean>(false);

    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [joinedLobby, setJoinedLobby] = useState(false);

    const baseImageUrl = '/images/questions/';
    const scrollYRef = useRef(0);
    const restoredScrollRef = useRef<number | null>(null);

    useEffect(() => { joinedLobbyRef.current = joinedLobby; }, [joinedLobby]);

    const storageKey = useMemo(() => {
        if (!hashedQuizId || !currentUserId) return '';
        return `quiz_session_${currentUserId}_${hashedQuizId}`;
    }, [currentUserId, hashedQuizId]);

    const clearStoredSession = useCallback(() => {
        if (!storageKey) return;
        localStorage.removeItem(storageKey);
    }, [storageKey]);

    const saveSession = useCallback(
        (nextAnswers: Record<number, number>, customFilter?: string, customLobbyState?: LobbyState | null) => {
            if (!storageKey || !hashedQuizId || !currentUserId) return;
            const deadlineEpoch = deadlineEpochRef.current;
            const payload: StoredQuizSession = {
                quizId: hashedQuizId,
                userId: currentUserId,
                answers: nextAnswers,
                questionTimes: questionTimesRef.current,
                selectionLog: selectionLogRef.current,
                quizStartEpoch: quizStartEpochRef.current,
                deadlineEpoch,
                expiresAt: deadlineEpoch,
                activeFilter: customFilter ?? activeFilter,
                scrollPosition: scrollYRef.current,
                lobbyState: customLobbyState ?? lobbyState,
                hasSubmitted: hasSubmittedRef.current || hasSubmittedSuccessfullyRef.current,
            };
            localStorage.setItem(storageKey, JSON.stringify(payload));
        },
        [storageKey, hashedQuizId, currentUserId, activeFilter, lobbyState],
    );

    const saveSessionRef = useRef(saveSession);
    const clearStoredSessionRef = useRef(clearStoredSession);
    const connectRef = useRef(connect);
    const initialQuizDataRef = useRef(initialQuizData);

    useEffect(() => {
        saveSessionRef.current = saveSession;
        clearStoredSessionRef.current = clearStoredSession;
        connectRef.current = connect;
        initialQuizDataRef.current = initialQuizData;
    });

    useEffect(() => { return () => { loadedQuizIdRef.current = null; }; }, []);

    // ─── Back-button interception ────────────────────────────────────────────
    useEffect(() => {
        if (!window.history.state?.noBack) {
            window.history.pushState({ noBack: true }, '', window.location.href);
        }
        const handlePopState = () => {
            if (isNavigatingAwayRef.current) return;
            window.history.pushState({ noBack: true }, '', window.location.href);
            setIsExitModalOpen(true);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // ─── beforeunload — warn on refresh/close ────────────────────────────────
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isNavigatingAwayRef.current || hasSubmittedSuccessfullyRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // ─── Tab-switch / visibility detection ───────────────────────────────────
    useEffect(() => {
        if (!isSessionReady) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                hiddenSinceRef.current = Date.now();
                lastTickTimeRef.current = Date.now();
            } else {
                if (hiddenSinceRef.current !== null && !hasSubmittedRef.current) {
                    hiddenSinceRef.current = null;
                    setIsTabWarningOpen(true);
                }
                lastTickTimeRef.current = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isSessionReady]);

    const confirmExit = () => {
        isNavigatingAwayRef.current = true;
        setIsExitModalOpen(false);
        if (onExit) onExit();
        else navigate('/', { replace: true });
    };

    const cancelExit = () => setIsExitModalOpen(false);

    const subjects = useMemo(() => {
        const subs = new Map<number, string>();
        questions.forEach((q) => { if (q.subject_id && q.subject) subs.set(q.subject_id, q.subject); });
        return Array.from(subs.entries()).map(([id, name]) => ({ id, name }));
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            if (activeFilter === 'answered') return answers[q.id] !== undefined;
            if (activeFilter === 'unanswered') return answers[q.id] === undefined;
            if (activeFilter.startsWith('sub_')) return q.subject_id === parseInt(activeFilter.replace('sub_', ''), 10);
            return true;
        });
    }, [answers, activeFilter, questions]);

    // ─── Scroll tracking ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!storageKey || !isSessionReady || isLoading) return;
        let throttleTimeout: any = null;
        const throttledScroll = () => {
            if (!throttleTimeout) {
                throttleTimeout = setTimeout(() => {
                    scrollYRef.current = window.scrollY;
                    try {
                        const raw = localStorage.getItem(storageKey);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            parsed.scrollPosition = window.scrollY;
                            localStorage.setItem(storageKey, JSON.stringify(parsed));
                        }
                    } catch {}
                    throttleTimeout = null;
                }, 200);
            }
        };
        window.addEventListener('scroll', throttledScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', throttledScroll);
            if (throttleTimeout) clearTimeout(throttleTimeout);
        };
    }, [storageKey, isSessionReady, isLoading]);

    // ─── Scroll restoration ───────────────────────────────────────────────────
    useEffect(() => {
        if (isSessionReady && restoredScrollRef.current !== null && questions.length > 0) {
            const scrollTarget = restoredScrollRef.current;
            window.scrollTo(0, scrollTarget);
            const timer = setTimeout(() => {
                window.scrollTo({ top: scrollTarget, behavior: 'auto' });
                restoredScrollRef.current = null;
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isSessionReady, questions]);

    // ─── Persist filter changes ───────────────────────────────────────────────
    useEffect(() => {
        if (!storageKey || !isSessionReady || isLoading) return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                parsed.activeFilter = activeFilter;
                localStorage.setItem(storageKey, JSON.stringify(parsed));
            }
        } catch {}
    }, [activeFilter, storageKey, isSessionReady, isLoading]);

    // ─── Persist lobby state changes ──────────────────────────────────────────
    useEffect(() => {
        if (!storageKey || !isSessionReady || isLoading || !lobbyState) return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                parsed.lobbyState = lobbyState;
                localStorage.setItem(storageKey, JSON.stringify(parsed));
            }
        } catch {}
    }, [lobbyState, storageKey, isSessionReady, isLoading]);

    // ─── IntersectionObserver for active question tracking ───────────────────
    useEffect(() => {
        if (isLoading || questions.length === 0) return;
        const observer = new IntersectionObserver((entries) => {
            let mostVisibleId: number | null = null;
            let maxRatio = 0;
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    const elId = entry.target.getAttribute('data-question-id');
                    if (elId) mostVisibleId = Number(elId);
                }
            });
            if (mostVisibleId !== null && maxRatio > 0) activeQuestionIdRef.current = mostVisibleId;
        }, {
            root: null,
            rootMargin: '-30% 0px -30% 0px',
            threshold: Array.from({ length: 11 }, (_, i) => i * 0.1),
        });
        Object.values(questionRefs.current).forEach((el) => { if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, [isLoading, questions]);

    // ─── Master timer tick ────────────────────────────────────────────────────
    useEffect(() => {
        if (isLoading || !isSessionReady || hasSubmittedRef.current) return;

        lastTickTimeRef.current = Date.now();

        const interval = setInterval(() => {
            if (document.hidden || hiddenSinceRef.current !== null) {
                lastTickTimeRef.current = Date.now();
                return;
            }

            const now = Date.now();
            const delta = now - lastTickTimeRef.current;
            lastTickTimeRef.current = now;

            const remaining = Math.max(0, Math.ceil((deadlineEpochRef.current - now) / 1000));
            setRemainingSeconds(remaining);

            if (remaining === 0) {
                clearInterval(interval);
            }

            const activeId = activeQuestionIdRef.current;
            if (activeId !== null) {
                if (activeId !== lastActiveQuestionIdRef.current) {
                    lastActiveQuestionIdRef.current = activeId;
                    currentFocusDurationRef.current = 0;
                } else {
                    currentFocusDurationRef.current += delta;
                }
                const isAnswered = answers[activeId] !== undefined;
                if (!isAnswered) {
                    questionTimesRef.current[activeId] = (questionTimesRef.current[activeId] || 0) + delta;
                } else if (currentFocusDurationRef.current > 5000) {
                    questionTimesRef.current[activeId] = (questionTimesRef.current[activeId] || 0) + delta;
                }
            } else {
                lastActiveQuestionIdRef.current = null;
                currentFocusDurationRef.current = 0;
            }

            setTick((t) => t + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [isLoading, isSessionReady, answers]);

    // ─── Lobby event handlers ─────────────────────────────────────────────────

    const handleLobbyState = useCallback((nextState: LobbyState) => {
        if (isPrivatePreviewRef.current) return;
        setLobbyState(nextState);
        if (!currentUserId) return;
        const err = validateLobbyAccess(nextState, currentUserId);
        if (err) setLobbyError(err); else setLobbyError(null);
    }, [currentUserId]);

    const handleLobbyStarted = useCallback((nextState: any) => {
        if (isPrivatePreviewRef.current) return;
        setLobbyState(nextState);

        if (nextState?.startedAt && nextState?.serverNow) {
            const transmissionOffset = Date.now() - nextState.serverNow;
            const remainingMs = deadlineEpochRef.current - Date.now();
            if (remainingMs <= 0 || nextState.startedAt > Date.now()) {
                const timeLimitMs = deadlineEpochRef.current
                    ? deadlineEpochRef.current - (nextState.startedAt - transmissionOffset)
                    : 20 * 60 * 1000;
                deadlineEpochRef.current = nextState.startedAt + timeLimitMs - transmissionOffset;
            }
        }

        if (!currentUserId) return;
        const err = validateLobbyAccess(nextState, currentUserId);
        if (err) setLobbyError(err); else setLobbyError(null);
    }, [currentUserId]);

    const handleLobbyDestroyed = useCallback((payload: any) => {
        if (isPrivatePreviewRef.current) return;
        setLobbyError(payload?.reason || 'لابی آزمون حذف یا بسته شده است.');
        setJoinedLobby(false);
    }, []);

    const handleKicked = useCallback((payload: any) => {
        if (isPrivatePreviewRef.current || !currentUserId) return;
        if (!payload?.userId || String(payload.userId) === String(currentUserId)) {
            setLobbyError(payload?.reason || 'شما از لابی آزمون خارج شدید.');
            setJoinedLobby(false);
        }
    }, [currentUserId]);

    const handleMemberJoined = useCallback((s: LobbyState) => { if (!isPrivatePreviewRef.current) setLobbyState(s); }, []);
    const handleMemberLeft = useCallback((s: LobbyState) => { if (!isPrivatePreviewRef.current) setLobbyState(s); }, []);
    const handleMemberUpdated = useCallback((s: LobbyState) => { if (!isPrivatePreviewRef.current) setLobbyState(s); }, []);

    const handleMemberProgress = useCallback((payload: any) => {
        if (isPrivatePreviewRef.current || !payload) return;
        if (payload?.members || payload?.data?.members || payload?.status) { setLobbyState(payload); return; }
        const progressUserId = payload?.userId ?? payload?.id ?? payload?.memberId;
        if (!progressUserId) return;
        setLobbyState((prev: any) => {
            if (!prev) return prev;
            const mapMembers = (members: any[]) =>
                members.map((m) => {
                    const mid = m?.userId ?? m?.id ?? m?.user?.id;
                    if (String(mid) !== String(progressUserId)) return m;
                    return {
                        ...m,
                        answeredCount: payload?.answeredCount ?? m?.answeredCount ?? 0,
                        totalQuestions: payload?.totalQuestions ?? m?.totalQuestions ?? questions.length,
                        progress: payload?.progress ?? m?.progress,
                    };
                });
            if (Array.isArray(prev?.members)) return { ...prev, members: mapMembers(prev.members) };
            if (Array.isArray(prev?.data?.members)) return { ...prev, data: { ...prev.data, members: mapMembers(prev.data.members) } };
            return prev;
        });
    }, [questions.length]);

    const handleQuizResult = useCallback((payload: QuizResult) => { console.log('Quiz result event:', payload); }, []);
    const handleLobbyError = useCallback((err: any) => {
        if (isPrivatePreviewRef.current) return;
        setLobbyError(err?.message || 'خطای لابی رخ داد.');
    }, []);

    useLobbyEvents({
        socket,
        onLobbyState: handleLobbyState,
        onLobbyStarted: handleLobbyStarted,
        onLobbyDestroyed: handleLobbyDestroyed,
        onKicked: handleKicked,
        onMemberJoined: handleMemberJoined,
        onMemberLeft: handleMemberLeft,
        onMemberUpdated: handleMemberUpdated,
        onMemberProgress: handleMemberProgress,
        onQuizResult: handleQuizResult,
        onLobbyError: handleLobbyError,
    });

    // ─── Quiz initialisation ──────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        const initQuiz = async () => {
            if (isAuthLoading) return;
            if (loadedQuizIdRef.current === hashedQuizId) return;
            if (!isAuthenticated || !currentUserId) {
                if (isMounted) { setError('برای ورود به آزمون باید وارد حساب کاربری شوید.'); setIsLoading(false); }
                return;
            }
            if (!hashedQuizId || typeof hashedQuizId !== 'string') {
                if (isMounted) { setError('شناسه آزمون نامعتبر است.'); setIsLoading(false); }
                return;
            }

            try {
                if (isMounted) { setIsLoading(true); setIsSessionReady(false); setError(null); setLobbyError(null); }

                const infoResponse = await flowApi.dispatch('get_quiz_info', { quizId: hashedQuizId });
                if (!isMounted) return;

                const quizInfo = infoResponse?.data || infoResponse || {};
                const visibility = quizInfo?.visibility;
                const creatorId = quizInfo?.creator_id;
                const status = quizInfo?.status;

                const rawApiTimeLimit = quizInfo?.time_limit ?? quizInfo?.data?.time_limit ?? quizInfo?.setting?.time ?? quizInfo?.settings?.time ?? quizInfo?.settings?.time_limit;
                const timeLimitSecs = (Number(rawApiTimeLimit) || 20) * 60;
                const timeLimitMs = timeLimitSecs * 1000;

                const isPrivateCreatorWaiting =
                    visibility === 'private' && String(creatorId) === String(currentUserId) && status === 'in_progress';
                isPrivatePreviewRef.current = isPrivateCreatorWaiting;

                let nextQuizData = initialQuizDataRef.current || {};
                let rawQuestions: any[] = [];

                if (!isPrivateCreatorWaiting) {
                    const memberResponse = await flowApi.dispatch('check_user_member', { quizId: hashedQuizId, userId: currentUserId });
                    if (!isMounted) return;
                    if (!isTruthyMemberResponse(memberResponse)) {
                        setError('شما عضو این آزمون نیستید.');
                        setIsLoading(false);
                        return;
                    }

                    let activeSocket = connectRef.current?.() ?? null;
                    if (!activeSocket) { setError('اتصال برقرار نشد.'); setIsLoading(false); return; }
                    await ensureSocketConnected(activeSocket);
                    if (!isMounted) return;

                    const fallbackCode = quizInfo?.code || quizInfo?.lobbyCode;
                    const lobbyCode = getLobbyCodeFromQuizData(initialQuizDataRef.current, fallbackCode || hashedQuizId);
                    lobbyCodeRef.current = lobbyCode;

                    // ── Join or rejoin lobby ─────────────────────────────────────────────
                    let joinedState: any;
                    try {
                        joinedState = await joinLobby(
                            activeSocket,
                            { code: lobbyCode, quizId: hashedQuizId, userId: String(currentUserId) } as any,
                        );
                    } catch (joinErr: unknown) {
                        const msg = getErrorMessage(joinErr, '');
                        const isAlreadyStarted =
                            msg.toLowerCase().includes('already started') ||
                            msg.toLowerCase().includes('lobby already started');

                        if (isAlreadyStarted) {
                            // Lobby transitioned to 'started' mid-join — fall back to rejoin
                            try {
                                const rejoinResult = await rejoinLobby(activeSocket, { code: lobbyCode } as any);

                                if (!rejoinResult?.ok) {
                                    // NOT_A_MEMBER: user was never in this lobby, genuinely blocked
                                    if (rejoinResult?.reason === 'NOT_A_MEMBER') {
                                        setError('آزمون شروع شده است و امکان ورود جدید وجود ندارد.');
                                        setLobbyError('آزمون شروع شده است و امکان ورود جدید وجود ندارد.');
                                        setIsLoading(false);
                                        return;
                                    }
                                    // LOBBY_NOT_FOUND or unknown reason
                                    setError('لابی این آزمون یافت نشد یا بسته شده است.');
                                    setLobbyError('لابی این آزمون یافت نشد یا بسته شده است.');
                                    setIsLoading(false);
                                    return;
                                }

                                joinedState = rejoinResult.state;
                            } catch (rejoinErr: unknown) {
                                const rejoinMsg = getErrorMessage(rejoinErr, 'خطا در اتصال مجدد به لابی.');
                                setError(rejoinMsg);
                                setLobbyError(rejoinMsg);
                                setIsLoading(false);
                                return;
                            }
                        } else {
                            // Some other join error (lobby full, locked, not found, etc.) — rethrow
                            throw joinErr;
                        }
                    }

                    if (!isMounted) return;

                    const accessError = validateLobbyAccess(joinedState, currentUserId);
                    if (accessError) {
                        setError(accessError);
                        setLobbyError(accessError);
                        setIsLoading(false);
                        return;
                    }

                    setLobbyState(joinedState);
                    setJoinedLobby(true);

                    const response = await flowApi.dispatch('get_quiz_questions', { quizId: hashedQuizId, userId: currentUserId });
                    if (!isMounted) return;

                    const { isAlreadySub, resId } = checkAlreadySubmitted(response);
                    if (isAlreadySub && resId) {
                        clearStoredSessionRef.current();
                        isNavigatingAwayRef.current = true;
                        navigate(`/result/${resId}`, { replace: true });
                        return;
                    }
                    if (!response?.success) { setError(response?.message || 'خطا در دریافت سوالات'); setIsLoading(false); return; }

                    rawQuestions = response?.questions || response?.data?.questions || [];
                    nextQuizData = response?.quiz || response?.data?.quiz || initialQuizDataRef.current || quizInfo || {};
                } else {
                    const response = await flowApi.dispatch('get_quiz_questions', { quizId: hashedQuizId, userId: currentUserId });
                    if (!isMounted) return;

                    const { isAlreadySub, resId } = checkAlreadySubmitted(response);
                    if (isAlreadySub && resId) {
                        clearStoredSessionRef.current();
                        isNavigatingAwayRef.current = true;
                        navigate(`/result/${resId}`, { replace: true });
                        return;
                    }
                    if (!response?.success) { setError(response?.message || 'خطا در دریافت سوالات'); setIsLoading(false); return; }

                    rawQuestions = response?.questions || response?.data?.questions || [];
                    nextQuizData = response?.quiz || response?.data?.quiz || initialQuizDataRef.current || quizInfo || {};
                }

                setQuizData(nextQuizData);
                setQuestions(rawQuestions.map(normalizeQuestion));

                // ── Session restore ──────────────────────────────────────────
                let restoredAnswers: Record<number, number> = {};
                let restoredFilter = 'all';
                let restoredScroll = 0;
                let restoredLobbyState: LobbyState | null = null;

                let quizStartEpoch = Date.now();
                let deadlineEpoch = quizStartEpoch + timeLimitMs;

                if (storageKey) {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) {
                        try {
                            const parsed: StoredQuizSession = JSON.parse(raw);
                            const now = Date.now();
                            const isValidSession =
                                parsed?.quizId === hashedQuizId &&
                                String(parsed?.userId) === String(currentUserId) &&
                                typeof parsed?.deadlineEpoch === 'number' &&
                                parsed.deadlineEpoch > now;

                            if (parsed?.hasSubmitted) {
                                hasSubmittedRef.current = true;
                                hasSubmittedSuccessfullyRef.current = true;
                                setError('این آزمون قبلاً ثبت شده است.');
                                setIsLoading(false);
                                return;
                            }

                            if (isValidSession) {
                                restoredAnswers = parsed.answers || {};
                                questionTimesRef.current = parsed.questionTimes || {};
                                selectionLogRef.current = parsed.selectionLog || [];
                                restoredFilter = parsed.activeFilter || 'all';
                                restoredScroll = parsed.scrollPosition || 0;
                                restoredLobbyState = parsed.lobbyState || null;
                                deadlineEpoch = parsed.deadlineEpoch;
                                quizStartEpoch = parsed.quizStartEpoch || (deadlineEpoch - timeLimitMs);
                            } else {
                                localStorage.removeItem(storageKey);
                            }
                        } catch {
                            localStorage.removeItem(storageKey);
                        }
                    }
                }

                const remaining = Math.ceil((deadlineEpoch - Date.now()) / 1000);
                if (remaining <= 0) {
                    clearStoredSessionRef.current();
                    setError('زمان این آزمون به پایان رسیده است.');
                    setIsLoading(false);
                    return;
                }

                quizStartEpochRef.current = quizStartEpoch;
                deadlineEpochRef.current = deadlineEpoch;

                setAnswers(restoredAnswers);
                setRemainingSeconds(remaining);
                setActiveFilter(restoredFilter);
                if (restoredLobbyState) setLobbyState(restoredLobbyState);
                restoredScrollRef.current = restoredScroll;

                saveSessionRef.current(restoredAnswers, restoredFilter, restoredLobbyState);

                if (isMounted) loadedQuizIdRef.current = hashedQuizId;
                setIsSessionReady(true);
            } catch (err: unknown) {
                console.error('Error initializing quiz:', err);
                if (!isMounted) return;
                const message = err instanceof SocketRequestError ? err.message : getErrorMessage(err, 'خطا در بارگذاری آزمون.');
                setError(message);
                setLobbyError(message);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        initQuiz();
        return () => { isMounted = false; };
    }, [isAuthLoading, isAuthenticated, currentUserId, hashedQuizId]);

    // ─── Persist answers on change ────────────────────────────────────────────
    useEffect(() => {
        if (!storageKey || !hashedQuizId || !isSessionReady || isLoading || hasSubmittedRef.current) return;
        if (deadlineEpochRef.current && Date.now() >= deadlineEpochRef.current) {
            clearStoredSession();
            return;
        }
        saveSession(answers);
    }, [answers, saveSession, storageKey, hashedQuizId, isSessionReady, isLoading, clearStoredSession]);

    // ─── Lobby presence is kept across quiz navigation; leave is explicit. ──

    // ─── Submit ───────────────────────────────────────────────────────────────

    const triggerSubmit = useCallback(async () => {
        if (isSubmitting || hasSubmittedRef.current || hasSubmittedSuccessfullyRef.current) return;
        if (!hashedQuizId || !currentUserId) { setError('اطلاعات آزمون ناقص است.'); return; }

        hasSubmittedRef.current = true;
        setIsSubmitting(true);
        setError(null);

        try {
            // FIX 1: Correctly calculate the elapsed quiz duration using the stable quiz start timestamp reference
            const secondsSpent = Math.max(0, Math.floor((Date.now() - quizStartEpochRef.current) / 1000));
            const questionIds = questions.map((q) => q.id);
            const payload = {
                quizId: hashedQuizId,
                userId: currentUserId,
                answers,
                questionIds,
                timeSpent: secondsSpent,
                questionTimes: questionTimesRef.current,
                selectionLog: selectionLogRef.current,
            };

            let response: any;
            if (isPrivatePreviewRef.current) {
                response = await flowApi.dispatch('submit_quiz_answers', payload);
            } else {
                if (!socket || !lobbyCodeRef.current) throw new Error('اتصال لابی برقرار نیست.');
                response = await submitQuiz(socket, { ...payload, code: lobbyCodeRef.current, userId: String(currentUserId) } as any);
            }

            hasSubmittedSuccessfullyRef.current = true;

            if (storageKey) {
                try {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        parsed.hasSubmitted = true;
                        localStorage.setItem(storageKey, JSON.stringify(parsed));
                    }
                } catch {}
            }

            clearStoredSession();

            if (isPrivatePreviewRef.current) {
                await flowApi.dispatch('finishing_quiz', { quizId });
            }

            const resultId =
                response?.result_id ?? response?.resultId ??
                response?.data?.result_id ?? response?.data?.resultId ??
                response?.summary?.result_id ?? response?.summary?.resultId;

            const responseData = response?.data ?? {};
            const resultQuestions = questions.map((q) => {
                const rd = responseData?.[q.id];
                if (rd) return { ...q, correct_option_id: rd.correct_option_id, descriptive_answer: rd.descriptive_answer?.text, points_earned: rd.points_earned };
                return q;
            });

            if (resultId) {
                isNavigatingAwayRef.current = true;
                navigate(`/result/${resultId}`, {
                    replace: true,
                    state: { quizId: hashedQuizId, userId: currentUserId, resultId, quizSummary: response?.summary || null, questions: resultQuestions, answers, quizData },
                });
                return;
            }

            setError('شناسه نتیجه از سمت سرور دریافت نشد.');
            hasSubmittedRef.current = false;
        } catch (err: unknown) {
            console.error('Submit Error:', err);
            const message = err instanceof SocketRequestError ? err.message : getErrorMessage(err, 'مشکلی در ارتباط با سرور هنگام ثبت آزمون پیش آمد.');
            setError(message);
            hasSubmittedRef.current = false;
        } finally {
            setIsSubmitting(false);
        }
    }, [socket, answers, isSubmitting, navigate, hashedQuizId, questions, quizData, clearStoredSession, currentUserId, storageKey, joinedLobby]);

    const handleTimeUp = useCallback(() => {
        clearStoredSession();
        triggerSubmit();
    }, [triggerSubmit, clearStoredSession]);

    const confirmFinish = useCallback(() => {
        setIsModalOpen(false);
        triggerSubmit();
    }, [triggerSubmit]);

    const handleSelectAnswer = useCallback((questionId: number, optionId: number) => {
        activeQuestionIdRef.current = questionId;
        lastActiveQuestionIdRef.current = questionId;
        currentFocusDurationRef.current = 0;

        setAnswers((prev) => {
            if (prev[questionId] !== optionId) {
                selectionLogRef.current.push({
                    questionId,
                    optionId,
                    timeSpentMs: questionTimesRef.current[questionId] || 0,
                    timestamp: Date.now(),
                });
            }

            const nextAnswers = { ...prev, [questionId]: optionId };

            if (!isPrivatePreviewRef.current && socket && joinedLobbyRef.current && currentUserId && hashedQuizId && lobbyCodeRef.current) {
                updateMemberProgress(socket, {
                    code: lobbyCodeRef.current,
                    quizId: hashedQuizId,
                    userId: String(currentUserId),
                    answeredCount: Object.keys(nextAnswers).length,
                    totalQuestions: questions.length,
                } as any);
            }
            return nextAnswers;
        });
    }, [socket, currentUserId, hashedQuizId, questions.length]);

    // ─── Avatar data ──────────────────────────────────────────────────────────
    const avatarDataList = useMemo<AvatarData[]>(() => {
        if (isPrivatePreviewRef.current || !joinedLobby) return [];
        const members = getLobbyMembers(lobbyState);
        const rawList = members.map((member) => {
            const memberId = member?.userId ?? member?.id ?? member?.user?.id ?? Math.random();
            const memberName = member?.displayName ?? member?.user?.username ?? 'کاربر';
            const isSelf = String(memberId) === String(currentUserId);
            const totalQ = member?.totalQuestions || questions.length || 1;
            const answeredQ = isSelf ? Object.keys(answers).length : (member?.answeredCount || 0);
            const rawProgress = member?.progress;
            const progressPercent = typeof rawProgress === 'number'
                ? Math.min(100, Math.max(0, rawProgress))
                : Math.min(100, Math.max(0, (answeredQ / totalQ) * 100));
            const avatarImg = member?.imageUrl ?? member?.user?.avatar ?? member?.avatarUrl ??
                `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(memberName)}`;
            return { id: memberId, imageUrl: avatarImg, name: memberName, progress: progressPercent };
        });

        const selfIndex = rawList.findIndex((item) => String(item.id) === String(currentUserId));
        if (selfIndex > -1) {
            const [selfItem] = rawList.splice(selfIndex, 1);
            rawList.unshift(selfItem);
        }
        return rawList;
    }, [lobbyState, questions.length, joinedLobby, answers, currentUserId]);

    const isPublicOrSocketConnected = useMemo(() => {
        const isPublic =
            quizData?.visibility === 'public' || quizData?.type === 'public' ||
            quizData?.setting?.visibility === 'public' || quizData?.settings?.visibility === 'public';
        return isPublic || socket?.connected || isConnected;
    }, [quizData, socket, isConnected]);

    // ─── Derived display values ───────────────────────────────────────────────
    const visibleError = error || lobbyError || socketError;
    const isLobbyMode = !isPrivatePreviewRef.current && joinedLobby;
    const showSidebar = isLobbyMode && avatarDataList.length > 0 && isPublicOrSocketConnected;
    const showMobileAvatars = isLobbyMode && avatarDataList.length > 0 && isPublicOrSocketConnected;
    const answeredCount = Object.keys(answers).length;
    const totalCount = questions.length;
    const progressPercent = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

    // ─── Error full-screen ────────────────────────────────────────────────────
    if (visibleError && !isLoading && questions.length === 0) {
        return (
            <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex items-center justify-center px-4" dir="rtl">
                <div className="w-full max-w-md text-center space-y-5">
                    <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center">
                        <AlertCircle size={30} />
                    </div>
                    <h1 className="text-xl font-black">خطا در بارگذاری آزمون</h1>
                    <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-4 text-rose-600 dark:text-rose-300 text-sm font-bold">
                        {visibleError}
                    </div>
                    <button onClick={() => navigate('/', { replace: true })} className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent)]/90 transition-colors">
                        بازگشت به داشبورد
                    </button>
                </div>
            </div>
        );
    }

    // ─── Loading skeleton ─────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full min-h-screen bg-[var(--bg-app)] pb-20" dir="rtl">
                <header className="sticky top-0 z-50 w-full bg-[var(--bg-app)]/90 backdrop-blur-xl border-b border-black/10 dark:border-white/10 h-16 md:h-20 flex items-center px-4 md:px-8 justify-between">
                    <div className="flex gap-2">
                        <Skeleton className="w-16 h-8 rounded-full" />
                        <Skeleton className="w-20 h-8 rounded-full" />
                    </div>
                    <Skeleton className="w-24 h-10 rounded-full" />
                </header>
                <div className="max-w-7xl mx-auto px-4 pt-6 md:pt-12 space-y-12">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="w-full pb-12 mb-12 border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                            <div className="flex items-center gap-4 mb-6">
                                <Skeleton className="w-12 h-12 rounded-lg" />
                                <Skeleton className="w-32 h-6 rounded-full" />
                            </div>
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1 space-y-4">
                                    <Skeleton className="w-full h-10 rounded-lg mb-8" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map((opt) => <Skeleton key={opt} className="w-full h-14 rounded-xl" />)}
                                    </div>
                                </div>
                                <div className="w-full md:w-48 shrink-0"><Skeleton className="w-full h-32 rounded-lg" /></div>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        );
    }

    // ─── Main render ──────────────────────────────────────────────────────────
    return (
        <div className={`w-full min-h-screen bg-[var(--bg-app)] text-zinc-900 dark:text-[#fafafa] pb-28 ${showSidebar ? 'lg:pr-[76px]' : ''}`} dir="rtl">

            {/* ── Fixed Header ── */}
            <header className={`fixed top-0 z-50 w-full bg-[var(--bg-app)]/90 backdrop-blur-xl border-b border-black/10 dark:border-white/10 h-16 md:h-20 ${showSidebar ? 'lg:pl-[76px]' : ''}`}>
                <div className="max-w-7xl mx-auto flex w-full px-4 h-full items-center justify-between animate-none">
                    <div className="hidden md:flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-hide flex-nowrap max-w-[30vw]">
                        <FilterGroup prefix="desktop" activeFilter={activeFilter} setActiveFilter={setActiveFilter} subjects={subjects} />
                    </div>

                    <div className="flex md:hidden items-center gap-3">
                        <QuestionCounter current={answeredCount} total={totalCount} />
                        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
                        {deadlineEpochRef.current > 0 && (
                            <CountdownTimer
                                key="mobile-timer"
                                deadlineEpoch={deadlineEpochRef.current}
                                onTimeUp={handleTimeUp}
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <div className="hidden md:flex items-center gap-4">
                            <div className="w-px h-5 bg-black/10 dark:bg-white/10" />
                            <QuestionCounter current={answeredCount} total={totalCount} />
                            <div className="w-px h-5 bg-black/10 dark:bg-white/10" />
                            {deadlineEpochRef.current > 0 && (
                                <CountdownTimer
                                    key="desktop-timer"
                                    deadlineEpoch={deadlineEpochRef.current}
                                    onTimeUp={handleTimeUp}
                                />
                            )}
                            <div className="w-px h-5 bg-black/10 dark:bg-white/10" />
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            disabled={isSubmitting || hasSubmittedRef.current}
                            className="group flex items-center gap-1 md:gap-2 text-xs md:text-sm font-bold text-[var(--accent)] border-2 border-[var(--accent)] px-4 py-1.5 rounded-full hover:bg-[var(--accent)] hover:text-white transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <span>{isSubmitting ? 'در حال ثبت...' : 'پایان'}</span>
                            {isSubmitting
                                ? <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                                : <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                            }
                        </button>
                    </div>
                </div>

                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: progressPercent / 100 }}
                    style={{ transformOrigin: 'right' }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[var(--accent)] z-50 animate-none"
                />
            </header>

            {/* ── Mobile filters ── */}
            <div className="md:hidden bg-[var(--bg-app)] py-3 mt-16 border-b border-black/10 dark:border-white/10">
                <div className="overflow-x-auto scrollbar-hide w-full">
                    <div className="flex justify-center items-center gap-2 min-w-max mx-auto px-4">
                        <FilterGroup prefix="mobile" activeFilter={activeFilter} setActiveFilter={setActiveFilter} subjects={subjects} />
                    </div>
                </div>
            </div>

            {/* ── Mobile sticky avatars ── */}
            {showMobileAvatars && (
                <div className="md:hidden sticky top-16 z-30 bg-[var(--bg-app)] border-b border-black/5 dark:border-white/5 px-4 py-2.5">
                    <AvatarList avatars={avatarDataList} />
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 pt-6 md:pt-12 lg:pt-25 pb-25">
                <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                    <div className="flex-1 min-w-0 w-full animate-none">
                        {!isPrivatePreviewRef.current && !joinedLobby && !isConnected && socketStatus === 'connecting' && (
                            <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-amber-700 dark:text-amber-300 text-sm font-bold">
                                در حال اتصال به لابی...
                            </div>
                        )}
                        {visibleError && questions.length > 0 && (
                            <div className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-rose-600 dark:text-rose-300 text-sm font-bold">
                                {visibleError}
                            </div>
                        )}

                        <AnimatePresence mode="popLayout">
                            {filteredQuestions.map((q, index) => (
                                <motion.section
                                    layout
                                    key={q.id}
                                    ref={(el) => (questionRefs.current[q.id] = el)}
                                    data-question-id={q.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.4, ease: butteryEase }}
                                    className="w-full relative animate-none"
                                >
                                    <div className="flex flex-col md:flex-row gap-6 w-full animate-none">
                                        <div className="flex-1 space-y-6 w-full animate-none">
                                            <div className="flex items-start w-full">
                                                <div className="text-lg md:text-xl flex font-bold leading-relaxed text-zinc-900 dark:text-zinc-100 w-full animate-none">
                                                    <div className="text-3xl md:text-4xl font-black text-[var(--accent)] tabular-nums leading-none tracking-tighter shrink-0 select-none ml-2">
                                                        {String(index + 1).padStart(2, '0')}
                                                    </div>
                                                    <div className="mt-1 flex-1 w-full min-w-0">
                                                        <MathRenderer text={decodeHtmlEntities(q.text)} subject={q.subject_id} />
                                                    </div>
                                                </div>
                                            </div>

                                            {q.has_image && q.image_url && (
                                                <div className="w-full md:w-48 shrink-0 flex justify-center md:justify-start">
                                                    <img src={`${baseImageUrl}${q.image_url}`} alt="تصویر" className="max-w-[200px] w-full rounded-lg object-contain border border-zinc-200 dark:border-zinc-800" />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                {q.options?.map((opt) => {
                                                    const isSelected = answers[q.id] === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => handleSelectAnswer(q.id, opt.id)}
                                                            disabled={isSubmitting}
                                                            className={`relative flex items-center w-full p-4 rounded-xl text-right transition-all border disabled:opacity-70 disabled:cursor-not-allowed ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                                                        >
                                                            <div className="relative z-10 flex items-center gap-4 w-full">
                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-zinc-400 dark:border-zinc-500'}`}>
                                                                    <AnimatePresence>
                                                                        {isSelected && (
                                                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                                                <Check size={12} className="text-white" strokeWidth={4} />
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                                <div className={`text-sm md:text-base flex-1 transition-colors ${isSelected ? 'text-[var(--accent)] font-bold' : 'text-zinc-700 dark:text-zinc-300 font-medium'}`}>
                                                                    <MathRenderer text={decodeHtmlEntities(opt.text)} subject={q.subject_id} />
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <hr className="border-zinc-200 dark:border-zinc-800 my-12" />
                                </motion.section>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </main>

            {/* ── Desktop sidebar ── */}
            {showSidebar && (
                <aside className="hidden lg:flex fixed top-0 right-0 h-screen w-[76px] z-40 border-l border-black/10 dark:border-white/10 flex-col items-center pt-4 pb-6 gap-5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {avatarDataList.map((avatar) => (
                        <AvatarWithProgress key={avatar.id} avatar={avatar} size={46} strokeWidth={2} />
                    ))}
                </aside>
            )}

            {/* ── Finish Quiz Modal ── */}
            <ResponsiveModal isOpen={isModalOpen} onClose={() => { if (!isSubmitting) setIsModalOpen(false); }} title="پایان آزمون">
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] mb-2">
                        <AlertCircle size={32} />
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm md:text-base font-bold">آیا از پایان دادن به این آزمون اطمینان دارید؟</p>
                    {answeredCount < totalCount && (
                        <p className="text-amber-500 dark:text-amber-400 text-xs font-bold">
                            {totalCount - answeredCount} سوال پاسخ داده نشده باقی مانده است.
                        </p>
                    )}
                    {visibleError && <p className="text-rose-500 text-sm font-bold">{visibleError}</p>}
                    <div className="flex w-full gap-3 pt-6">
                        <button onClick={confirmFinish} disabled={isSubmitting || hasSubmittedRef.current} className="flex-1 py-3 px-4 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {isSubmitting ? <><Loader2 size={18} className="animate-spin" /><span>در حال ثبت...</span></> : 'بله، ثبت و مشاهده نتیجه'}
                        </button>
                        <button onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex-1 py-3 px-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                            خیر، ادامه می‌دهم
                        </button>
                    </div>
                </div>
            </ResponsiveModal>

            {/* ── Exit Confirmation Modal (back button) ── */}
            <ResponsiveModal isOpen={isExitModalOpen} onClose={cancelExit} title="خروج از آزمون">
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2">
                        <AlertCircle size={32} />
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm md:text-base font-bold">آیا مطمئن هستید که می‌خواهید از آزمون خارج شوید؟</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">پیشرفت شما ذخیره شده و با بازگشت قابل ادامه است. اما آزمون نهایی نخواهد شد.</p>
                    <div className="flex w-full gap-3 pt-6">
                        <button onClick={confirmExit} className="flex-1 py-3 px-4 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-colors">
                            بله، خروج از آزمون
                        </button>
                        <button onClick={cancelExit} className="flex-1 py-3 px-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                            خیر، ادامه می‌دهم
                        </button>
                    </div>
                </div>
            </ResponsiveModal>

            {/* ── Tab Switch Warning Modal ── */}
            <ResponsiveModal isOpen={isTabWarningOpen} onClose={() => setIsTabWarningOpen(false)} title="توجه">
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 mb-2">
                        <AlertCircle size={32} />
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm md:text-base font-bold">
                        تب آزمون را ترک کردید
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        تایمر آزمون در حین غیبت شما ادامه داشته است. پاسخ‌های شما ذخیره شده‌اند.
                    </p>
                    <div className="w-full pt-4">
                        <button
                            onClick={() => setIsTabWarningOpen(false)}
                            className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent)]/90 transition-colors"
                        >
                            متوجه شدم، ادامه می‌دهم
                        </button>
                    </div>
                </div>
            </ResponsiveModal>

        </div>
    );
}