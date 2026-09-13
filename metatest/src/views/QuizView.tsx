import { useState, useEffect, useCallback, useRef } from 'react';
import { flowApi } from '../lib/authApi';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Heart, Archive, AlertTriangle, Timer, Power, LogOut, Bookmark, ArrowRight, ArrowLeft,
    MoreVertical, FileText, ChevronRight, ChevronLeft, CheckCircle2, XCircle, X, Check, Sparkles, Volume2, VolumeX
} from 'lucide-react';

import { useAudio } from '../hooks/useAudio';
import { useUser } from '../context/UserContext';
import {
    getActiveQuizStateById,
    getActiveQuizStates,
    getConfigKey,
    upsertActiveQuizState,
    deleteActiveQuizStateById,
    getResumedElapsedSeconds,
    getResumedRemainingSeconds,
    type ActiveQuizState,
    type ActiveQuizTimerState,
} from "../lib/utils";

import { toast } from 'sonner';
import { ResponsiveModal } from '../components/ResponsiveModal';
import { QuestionGeneralInfo } from '../components/QuestionGeneralInfo';
import { QuestionTimer } from '../components/QuestionTimer';
import { QuestionCounter } from '../components/QuestionCounter';
import QuestionStatsDisplay, { type StatItem } from '../components/QuestionStatsDisplay';
import { QuizCountdown } from '../components/QuizCountdown';
import { MathRenderer } from '../components/ui/MathRenderer';
import {GameRewardToast} from '../components/GameRewardToast';
import { Met } from '../components/met';
import { QuizMetPanel } from './met/QuizMetPanel';

import React from 'react';

// --- Configuration & Constants ---
// --- API CONFIG ---
const API_URL = import.meta.env.API_URL;
const IMAGE_BASE = 'images/questions/';
const APP_TOKEN = import.meta.env.APP_TOKEN;
const MIN_LOAD_DURATION = 500;

// --- Types ---
type Option = { id: number; text: string };
type Question = {
    id: number;
    text: string;
    options: Option[];
    has_image: boolean;
    images: string[];
    grade_id?: number;
    subject_id?: number;
    topic_id?: number;
    chapter_id?: number;
    major_id?: number;
    academic_year?: number;
    difficulty_level?: number;
    grade?: string;
    subject?: string;
    topic?: string;
    chapter?: string;
    stats?: {
        correct_percent: number;
        wrong_percent: number;
        unanswered_percent: number;
    };
    previous_status: boolean | null; // Can be true, false, or null
    // Added optional fields in case the API returns initial status
    is_favorite?: boolean;
    is_review_later?: boolean;
    user_note?: string;
};





type Stats = { id?: number; option_id?: number; percent: number };

// Expanded History Type
type HistoryEntry = {
    question: Question;
    selectedOptionId: number | null;
    isAnswered: boolean;
    isCorrect: boolean | null;
    correctOptionId: number | null;
    descriptiveAnswer: string | null;
    optionStats: Stats[];
    totalQuestions: number;
    currentQuestionCount: number;
    // Action States
    isFavorite: boolean;
    isReviewLater: boolean;
    noteText: string;
};

// --- Helpers ---
const decodeHtmlEntities = (text: string) => {
    if (!text) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = text;
    let decoded = txt.value;
    decoded = decoded
        .replace(/\u200c|\u200d|\u200e|\u200f|\ufeff/g, '')
        .replace(/&zwnj;|&zwj;|&lrm;|&rlm;|&nbsp;/gi, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    return decoded;
};

// skeleton
const QuizSkeleton = () => (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
        <div className="w-full flex flex-col items-center mb-8">
            <div className="w-full max-w-6xl px-2 md:px-4 fade-mask-both md:![-webkit-mask:none] md:![mask:none]">
                <div className="flex items-center justify-start md:justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2 gap-4 md:gap-5">
                    <div className="w-6 md:w-0 flex-shrink-0" />
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <React.Fragment key={idx}>
                            <div className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                                <div className="skeleton-block w-[14px] h-[14px] rounded-sm flex-shrink-0"></div>
                                <div className="skeleton-block h-2.5 w-7 rounded-sm flex-shrink-0"></div>
                                <div className="skeleton-block h-3.5 w-10 rounded-sm flex-shrink-0"></div>
                            </div>
                            {idx < 5 && (
                                <div className="skeleton-block w-1 h-1 rounded-full flex-shrink-0"></div>
                            )}
                        </React.Fragment>
                    ))}
                    <div className="w-6 md:w-0 flex-shrink-0" />
                </div>
            </div>
        </div>

        <div className="md:bg-[var(--bg-card)] md:border md:border-[var(--border)] md:rounded-3xl md:p-6">
            <div className="skeleton-block h-5 w-4/5 mb-3 rounded-lg md:mb-4"></div>
            <div className="skeleton-block h-5 w-3/4 mb-3 rounded-lg"></div>
            <div className="skeleton-block h-5 w-1/2 rounded-lg"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[4.5rem] rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex items-center px-4 justify-between">
                    <div className="skeleton-block w-8 h-8 rounded-full flex-shrink-0"></div>
                    <div className="skeleton-block h-4 w-1/2 rounded"></div>
                </div>
            ))}
        </div>
    </div>
);

export function QuizView({
                             config,
                             resumeId,
                             onFinish,
                             exitRequested,
                             onConfirmExit,
                             onCancelExit,
                         }: {
    config: any;
    resumeId?: string;
    onFinish: () => void;
    exitRequested?: boolean;
    onConfirmExit?: () => void;
    onCancelExit?: () => void;
}) {



    // --- State ---
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Pagination & History
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    const [totalQuestions, setTotalQuestions] = useState<number>(0);
    const [currentQuestionCount, setCurrentQuestionCount] = useState<number>(0);

    const [question, setQuestion] = useState<Question | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);

    // Quiz Logic State
    const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [correctOptionId, setCorrectOptionId] = useState<number | null>(null);
    const [descriptiveAnswer, setDescriptiveAnswer] = useState<string | null>(null);
    const [optionStats, setOptionStats] = useState<Stats[]>([]);

    // Action States
    const [isFavorite, setIsFavorite] = useState(false);
    const [isReviewLater, setIsReviewLater] = useState(false);

    // UI State
    const [showButtons, setShowButtons] = useState(true);
    const [resultState, setResultState] = useState<'correct' | 'wrong' | null>(null);
    const [metOpen, setMetOpen] = useState(false);

    useEffect(() => {
        if (!isAnswered) setMetOpen(false);
    }, [isAnswered]);

    // Modals State
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportIssue, setReportIssue] = useState('wrong_info');
    const [reportText, setReportText] = useState('');

    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteText, setNoteText] = useState('');

    const resultTimeoutRef = useRef<number | null>(null);
    const [isCountingDown, setIsCountingDown] = useState(true);
    const [quizElapsedSeconds, setQuizElapsedSeconds] = useState(0);
    const [isHydrated, setIsHydrated] = useState(false);


    // Refs
    const contentRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);

    // Audio
    const playCorrect = useAudio('/sounds/Correct.mp3');
    const playWrong = useAudio('/sounds/Wrong.mp3');



    const [quizResumeId, setQuizResumeId] = useState<string | null>(null);

    const [isRewardToastOpen, setIsRewardToastOpen] = useState(false);
    const [rewardData, setRewardData] = useState<any | null>(null);
    const isFirstRender = useRef(true);

    const { updateUserRewards } = useUser();


    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (
                isMobileMenuOpen &&
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(event.target as Node)
            ) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [isMobileMenuOpen]);



    // --- History Helper ---
    const updateCurrentHistoryEntry = useCallback((updates: Partial<HistoryEntry>) => {
        setHistory(prev => {
            const newHistory = [...prev];
            if (historyIndex >= 0 && historyIndex < newHistory.length) {
                newHistory[historyIndex] = { ...newHistory[historyIndex], ...updates };
            }
            return newHistory;
        });
    }, [historyIndex]);



    const createQuizResumeId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return `quiz_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    };

    const playSound = (audio: HTMLAudioElement) => {
        if (!isMuted) {
            audio.currentTime = 0; // Reset to start if played rapidly
            audio.play().catch(e => console.log("Audio play prevented:", e));
        }
    };


    const applyHistoryState = useCallback((index: number, currentHistory: HistoryEntry[]) => {
        const entry = currentHistory[index];
        if (!entry) return;

        setQuestion(entry.question);
        setSelectedOptionId(entry.selectedOptionId);
        setIsAnswered(entry.isAnswered);
        setIsCorrect(entry.isCorrect);
        setCorrectOptionId(entry.correctOptionId);
        setDescriptiveAnswer(entry.descriptiveAnswer);
        setOptionStats(entry.optionStats);
        setTotalQuestions(entry.totalQuestions);
        setCurrentQuestionCount(entry.currentQuestionCount);

        // Restore actions state
        setIsFavorite(entry.isFavorite);
        setIsReviewLater(entry.isReviewLater);
        setNoteText(entry.noteText);
    }, []);




    // --- API Interactions ---
    const startSession = useCallback(async () => {
        const response = await flowApi.dispatch('start_session');
        if (!response.success) throw new Error(response.message || 'Session error');
        setSessionId(response.session_id);
        return response.session_id as number;
    }, []);

    const handleFinish = useCallback(() => {
        if (quizResumeId) {
            deleteActiveQuizStateById(quizResumeId);
        }

        setIsExitModalOpen(false);
        onCancelExit?.();

        onFinish();
    }, [quizResumeId, onFinish, onCancelExit]);




    const fetchQuestionWithDelay = useCallback(async (sid: number) => {
        const startTime = Date.now();
        try {
            const payload = {
                session_id: sid,
                grade_id: config?.grade_id ?? null,
                subject_id: config?.subject_id ?? null,
                topic_id: config?.topic_id ?? null,
                chapter_id: config?.chapter_id ?? null,
                major_id: config?.major_id ?? null,
                academic_year: config?.academic_year ?? null,
                difficulty_level: config?.difficulty_level ?? null
            };
            const response = await flowApi.dispatch('get_practice_question', payload);
            const elapsed = Date.now() - startTime;
            const remaining = MIN_LOAD_DURATION - elapsed;
            if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

            if (!response.success) throw new Error(response.message || 'API error');

            return {
                question: response.question as Question | null,
                total_questions: response.total_questions as number,
                current_question_count: response.current_question_count as number
            };
        } catch (error) {
            console.error("Fetch error:", error);
            return null;
        }
    }, [config]);



    const restoreFromSavedState = useCallback((saved: ActiveQuizState) => {
        setQuizResumeId(saved.id);
        setSessionId(saved.sessionId ?? null);

        setCurrentQuestionCount(saved.currentQuestionCount ?? 0);
        setTotalQuestions(saved.totalQuestions ?? 0);
        setHistoryIndex(saved.historyIndex ?? -1);

        setQuestion(saved.question ?? null);
        setHistory(saved.history ?? []);

        setSelectedOptionId(saved.selectedOptionId ?? null);
        setIsAnswered(saved.isAnswered ?? false);
        setIsCorrect(saved.isCorrect ?? null);
        setCorrectOptionId(saved.correctOptionId ?? null);
        setDescriptiveAnswer(saved.descriptiveAnswer ?? null);
        setOptionStats(saved.optionStats ?? []);

        setIsFavorite(saved.isFavorite ?? false);
        setIsReviewLater(saved.isReviewLater ?? false);
        setNoteText(saved.noteText ?? '');

        setQuizElapsedSeconds(getResumedElapsedSeconds(saved.timer));
        setIsHydrated(true);
    }, []);


    const loadNewQuestion = useCallback(async (isInitial = false) => {
        setIsLoading(true);
        setSelectedOptionId(null);
        setIsAnswered(false);
        setIsCorrect(null);
        setCorrectOptionId(null);
        setDescriptiveAnswer(null);
        setOptionStats([]);
        setIsFavorite(false);
        setIsReviewLater(false);
        setNoteText('');

        setShowButtons(true);
        setResultState(null);
        if (resultTimeoutRef.current) {
            clearTimeout(resultTimeoutRef.current);
            resultTimeoutRef.current = null;
        }

        try {
            let sid = sessionId;
            if (isInitial || !sid) sid = await startSession();

            if (sid) {
                const data = await fetchQuestionWithDelay(sid);
                if (!data || !data.question) {
                    handleFinish();
                    return;
                }




                const q = data.question;
                q.text = decodeHtmlEntities(q.text);
                q.options = q.options.map(o => ({ ...o, text: decodeHtmlEntities(o.text) }));

                const totalQ = data.total_questions || 0;
                const currQCount = data.current_question_count || 0;

                const initialFavorite = q.is_favorite || false;
                const initialReview = q.is_review_later || false;
                const initialNote = q.user_note || '';

                // Add to history
                const newEntry: HistoryEntry = {
                    question: q,
                    selectedOptionId: null,
                    isAnswered: false,
                    isCorrect: null,
                    correctOptionId: null,
                    descriptiveAnswer: null,
                    optionStats: [],
                    totalQuestions: totalQ,
                    currentQuestionCount: currQCount,
                    isFavorite: initialFavorite,
                    isReviewLater: initialReview,
                    noteText: initialNote
                };

                setHistory(prev => {
                    const newHistory = [...prev, newEntry];
                    setHistoryIndex(newHistory.length - 1);
                    return newHistory;
                });

                // Apply to current view
                setQuestion(q);
                setTotalQuestions(totalQ);
                setCurrentQuestionCount(currQCount);
                setIsFavorite(initialFavorite);
                setIsReviewLater(initialReview);
                setNoteText(initialNote);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, startSession, fetchQuestionWithDelay, handleFinish]);


    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return; // Skip opening modal on initial mount
        }

        if (exitRequested) {
            setIsExitModalOpen(true);
        }
    }, [exitRequested]);



    useEffect(() => {
        if (isCountingDown) return;
        if (isLoading) return;

        const interval = window.setInterval(() => {
            setQuizElapsedSeconds((prev) => prev + 1);
        }, 1000);

        return () => window.clearInterval(interval);
    }, [isCountingDown, isLoading]);


    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const initQuiz = async () => {
            setIsLoading(true);

            try {
                // Resume existing quiz
                if (resumeId) {
                    const saved = getActiveQuizStateById(resumeId);

                    if (saved) {
                        restoreFromSavedState(saved);
                        setIsLoading(false);
                        return;
                    }
                }

                // Start brand new quiz
                const newId = createQuizResumeId();
                setQuizResumeId(newId);
                setQuizElapsedSeconds(0);
                await loadNewQuestion(true);
                setIsHydrated(true);
            } catch (err) {
                console.error(err);
                setIsLoading(false);
            }
        };

        void initQuiz();
    }, [resumeId, loadNewQuestion, restoreFromSavedState]);



    const handleExitCancel = () => {
        setIsExitModalOpen(false);
        onCancelExit?.();
    };

    const handleExitConfirm = () => {
        setIsExitModalOpen(false);
        handleFinish();
        onConfirmExit?.();
    };




    const buildTimerSnapshot = useCallback((): ActiveQuizTimerState => {
        return {
            mode: "elapsed",
            elapsedSeconds: quizElapsedSeconds,
            remainingSeconds: null,
            savedAt: new Date().toISOString(),
        };
    }, [quizElapsedSeconds]);

    useEffect(() => {
        if (!isHydrated) return;
        if (!quizResumeId) return;
        if (!config) return;
        if (!question) return;
        if (totalQuestions <= 0) return;
        if (currentQuestionCount <= 0) return;


        const timeout = window.setTimeout(() => {
            upsertActiveQuizState({
                id: quizResumeId,
                config,
                sessionId,
                currentQuestionCount,
                totalQuestions,
                historyIndex,
                question,
                history,
                selectedOptionId,
                isAnswered,
                isCorrect,
                correctOptionId,
                descriptiveAnswer,
                optionStats,
                isFavorite,
                isReviewLater,
                noteText,
                timer: buildTimerSnapshot(),
            });
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [
        quizResumeId,
        config,
        sessionId,
        currentQuestionCount,
        totalQuestions,
        historyIndex,
        question,
        history,
        selectedOptionId,
        isAnswered,
        isCorrect,
        correctOptionId,
        descriptiveAnswer,
        optionStats,
        isFavorite,
        isReviewLater,
        noteText,
        buildTimerSnapshot,
    ]);





    // --- Handlers ---

    const [isMuted, setIsMuted] = useState<boolean>(() => {
        const saved = localStorage.getItem('quiz_muted');
        return saved ? JSON.parse(saved) : false;
    });

    const toggleMute = () => {
        setIsMuted((prev) => {
            const newState = !prev;
            localStorage.setItem('quiz_muted', JSON.stringify(newState));
            return newState;
        });
    };


    const handleCheckAnswer = async () => {
        if (!question || !selectedOptionId || isAnswered || isChecking) return;

        setIsChecking(true);
        try {
            await new Promise(res => setTimeout(res, 600));
            const response = await flowApi.dispatch('checkAnswer', {
                question_id: question.id,
                option_id: selectedOptionId
            });

            if (!response.success) throw new Error(response.message);

            const fetchedCorrectOptionId = response.correct_option_id ?? null;
            const fetchedDescAnswer = response.descriptive_answer ? decodeHtmlEntities(response.descriptive_answer) : null;
            const fetchedOptionStats = response.option_stats ?? [];

            // Update local state
            setIsCorrect(response.is_correct);
            setCorrectOptionId(fetchedCorrectOptionId);
            setDescriptiveAnswer(fetchedDescAnswer);
            setOptionStats(fetchedOptionStats);
            setIsAnswered(true);

            // Update History Entry
            updateCurrentHistoryEntry({
                selectedOptionId: selectedOptionId,
                isAnswered: true,
                isCorrect: response.is_correct,
                correctOptionId: fetchedCorrectOptionId,
                descriptiveAnswer: fetchedDescAnswer,
                optionStats: fetchedOptionStats
            });

            if (response.is_correct) {
                playCorrect();
            } else {
                playWrong();
            }

            const reward = response.reward_data || {};

            const addedTrophies = Number(reward.added_trophies ?? 0);
            const addedXp = Number(reward.added_xp ?? 0);

            setRewardData({
                previous_status: reward.previous_status ?? false,
                current_trophies: Number(reward.current_trophies ?? 0),
                current_xp: Number(reward.current_xp ?? 0),
                current_status: reward.current_status ?? (response.is_correct ? 'correct' : 'wrong'),
                reason: reward.reason ?? '',
                added_trophies: addedTrophies,
                added_xp: addedXp,
                bonus_awarded: reward.bonus_awarded ?? false,
                bonus_value: Number(reward.bonus_value ?? 0),
                current_level: Number(reward.current_level ?? 1),
                leveled_up: Boolean(reward.leveled_up ?? false),
            });

            updateUserRewards(addedTrophies, addedXp);
            setIsRewardToastOpen(true);


            setShowButtons(false);
            setResultState(response.is_correct ? 'correct' : 'wrong');
            resultTimeoutRef.current = window.setTimeout(() => {
                setResultState(null);
                setShowButtons(true);
            }, 1500);
        } catch (err) {
            console.error(err);
        } finally {
            setIsChecking(false);
        }
    };

    const handleNext = () => {
        // If browsing old history, go forward in history
        if (historyIndex < history.length - 1) {
            const nextIdx = historyIndex + 1;
            setHistoryIndex(nextIdx);
            applyHistoryState(nextIdx, history);
            return;
        }

        // If this is the last question, finish quiz
        if (totalQuestions > 0 && currentQuestionCount >= totalQuestions) {
            handleFinish();
            return;
        }

        // Otherwise load next question
        loadNewQuestion();
    };


    const handlePrev = () => {
        if (historyIndex > 0) {
            const prevIdx = historyIndex - 1;
            setHistoryIndex(prevIdx);
            applyHistoryState(prevIdx, history);
        }
    };

    // --- ACTION HANDLERS ---
    const handleToggleFavorite = () => {
        if (!question) return;
        const newStatus = !isFavorite;

        // Optimistic update
        setIsFavorite(newStatus);
        updateCurrentHistoryEntry({ isFavorite: newStatus });

        const action = newStatus ? 'add_favorite' : 'remove_favorite';
        const msgSuccess = newStatus ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد';

        const promise = flowApi.dispatch(action, { question_id: question.id })
            .then(res => {
                if (!res.success) throw new Error(res.message);
                return msgSuccess;
            }).catch(err => {
                // Revert on fail
                setIsFavorite(!newStatus);
                updateCurrentHistoryEntry({ isFavorite: !newStatus });
                throw new Error(err.message || 'خطا در ارتباط با سرور');
            });

        toast.promise(promise, {
            loading: 'در حال ثبت...',
            success: (msg) => msg,
            error: (err) => err.message,
        });
    };

    const handleToggleReviewLater = () => {
        if (!question) return;
        const newStatus = !isReviewLater;

        // Optimistic update
        setIsReviewLater(newStatus);
        updateCurrentHistoryEntry({ isReviewLater: newStatus });

        const action = newStatus ? 'add_to_review_later' : 'remove_from_review_later';
        const msgSuccess = newStatus ? 'به مرور مجدد اضافه شد' : 'از مرور مجدد حذف شد';

        const promise = flowApi.dispatch(action, { question_id: question.id })
            .then(res => {
                if (!res.success) throw new Error(res.message);
                return msgSuccess;
            }).catch(err => {
                // Revert on fail
                setIsReviewLater(!newStatus);
                updateCurrentHistoryEntry({ isReviewLater: !newStatus });
                throw new Error(err.message || 'خطا در ارتباط با سرور');
            });

        toast.promise(promise, {
            loading: 'در حال ثبت...',
            success: (msg) => msg,
            error: (err) => err.message,
        });
    };

    const handleSaveNote = () => {
        if (!question) return;

        const promise = flowApi.dispatch('add_note', {
            question_id: question.id,
            note_text: noteText
        }).then(res => {
            if (!res.success) throw new Error(res.message);
            updateCurrentHistoryEntry({ noteText: noteText });
            return 'یادداشت با موفقیت ذخیره شد.';
        });

        toast.promise(promise, {
            loading: 'در حال ذخیره یادداشت...',
            success: (msg) => {
                setIsNoteModalOpen(false);
                return msg;
            },
            error: (err) => err.message || 'خطا در ذخیره یادداشت',
        });
    };

    const submitReport = () => {
        if (!question) return;

        const promise = flowApi.dispatch('report_question', {
            question_id: question.id,
            issue: reportIssue,
            report_text: reportText
        }).then(res => {
            if (!res.success) throw new Error(res.message);
            return 'گزارش شما با موفقیت ثبت شد.';
        });

        toast.promise(promise, {
            loading: 'در حال ارسال گزارش...',
            success: (msg) => {
                setIsReportModalOpen(false);
                setReportText('');
                setReportIssue('wrong_info');
                return msg;
            },
            error: (err) => err.message || 'خطا در ثبت گزارش',
        });
    };

    // Dynamic Stats Array Map
    const currentStats = React.useMemo(() => {
        if (!question?.stats) return [];

        let statsArray: any[] = [
            { id: 1, label: 'پاسخ صحیح داده‌اند', percentage: question.stats.correct_percent, color: '#10b981' },
            { id: 2, label: 'پاسخ غلط داده‌اند', percentage: question.stats.wrong_percent, color: '#ef4444' },
            { id: 3, label: 'بدون پاسخ گذاشته‌اند', percentage: question.stats.unanswered_percent, color: '#f59e0b' },

        ];

        if (question.previous_status === 'correct') {
            statsArray.unshift({
                id: 'prev-correct',
                label: (
                    <>
                        شما قبلاً پاسخ <span style={{ color: '#10b981' }}>صحیح</span> داده‌اید
                    </>
                ),
                color: '#10b981',
                iconAnimation: 'check' as const,

            });
        } else if (question.previous_status === 'wrong') {
            statsArray.unshift({
                id: 'prev-incorrect',
                label: (
                    <>
                        شما قبلاً پاسخ <span style={{ color: '#ef4444' }}>غلط</span> داده‌اید
                    </>
                ),
                color: '#ef4444',
                iconAnimation: 'x' as const,

            });
        }

        return statsArray;
    }, [question?.stats, question?.previous_status]);

    // --- Renderers ---
    const renderOption = (option: Option, index: number, subject: number) => {
        const isSelected = selectedOptionId === option.id;
        const isActuallyCorrect = isAnswered && correctOptionId === option.id;
        const isMyWrongSelection =
            isAnswered && isSelected && !isActuallyCorrect && isCorrect === false;

        let containerClass = "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-element)]";
        let badgeClass = "bg-[var(--bg-element)] text-[var(--text-muted)] group-hover:bg-[var(--text-muted)] group-hover:text-white";

        if (isAnswered) {
            if (isActuallyCorrect) {
                containerClass = "border-green-500 bg-green-500/10";
                badgeClass = "bg-green-500 text-white";
            } else if (isMyWrongSelection) {
                containerClass = "border-red-500 bg-red-500/10";
                badgeClass = "bg-red-500 text-white";
            } else {
                containerClass = "border-[var(--border)] opacity-60 grayscale-[0.5]";
            }
        } else if (isSelected) {
            containerClass = "border-[var(--text-muted)] bg-[var(--bg-element)]/60";
            badgeClass = "bg-[var(--text-muted)] text-white";
        }

        const stat = optionStats.find(s => s.id === option.id || s.option_id === option.id);
        const percent = stat ? stat.percent : 0;

        return (
            <div key={option.id} className="relative group">
                <button
                    onClick={() => { if (!isAnswered && !isChecking) setSelectedOptionId(option.id); }}
                    disabled={isAnswered || isChecking}
                    className={`relative w-full text-right p-4 rounded-xl border-2 transition-all duration-300 flex items-center justify-between min-h-[4.5rem] ${containerClass}`}
                >
                    <div className="flex items-center gap-4 w-full">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors duration-300 shrink-0 ${badgeClass}`}>
                            {index + 1}
                        </div>
                        <span className="font-medium tracking-normal text-[var(--text-primary)] leading-7 md:leading-8 select-none text-[14px] md:text-[15px]">
                       <MathRenderer text={option.text} subject={subject} inline={true}/>
                    </span>
                    </div>

                    <div className="shrink-0 mr-2">
                        {isAnswered && (
                            <>
                                {isActuallyCorrect && <CheckCircle2 className="text-green-500 w-6 h-6 fill-green-500/20" />}
                                {isMyWrongSelection && <XCircle className="text-red-500 w-6 h-6 fill-red-500/20" />}
                            </>
                        )}
                    </div>
                </button>

                {/* Statistics Progress Bar */}
                {isAnswered && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 w-full"
                    >
                        <div className="h-2 w-full bg-[var(--bg-element)] rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 0.8, ease: "circOut" }}
                                className={`h-full ${isActuallyCorrect ? 'bg-green-500' : isMyWrongSelection ? 'bg-red-500' : 'bg-[var(--text-muted)]'}`}
                            />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1 text-left font-mono">{percent}%</p>
                    </motion.div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full w-full bg-[var(--bg-app)] relative">
            {isCountingDown ? (
                <QuizCountdown onComplete={() => setIsCountingDown(false)} />
            ) : (
                <>
                    <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>

                    {/* Header */}
                    <header className="relative top-0 z-30 h-20 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-[var(--border)] app-fixed-shell">
                        {/* --- DESKTOP LAYOUT --- */}
                        <div dir="rtl" className="hidden md:grid grid-cols-3 max-w-6xl mx-auto h-full px-4 items-center">
                            <div className="flex justify-start items-center gap-4">
                                <QuestionTimer seconds={quizElapsedSeconds} isLoading={!question} />
                                <div className="w-px h-5 bg-[var(--border)]"></div>
                                <div className="text-sm font-medium text-[var(--text-muted)]">
                                    <QuestionCounter
                                        isLoading={!question}
                                        current={currentQuestionCount}
                                        total={totalQuestions}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center text-center overflow-hidden">
                                <span className="text-sm p-2 font-bold text-[var(--text-primary)] fade-mask-both truncate w-full max-w-[250px]">
                                    {config?.title || 'تمرین'}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase opacity-70">
                                    Quiz Mode
                                </span>
                            </div>

                            <div className="flex justify-end items-center gap-2">
                                <button
                                    onClick={handleToggleFavorite}
                                    className={`action-icon transition-all duration-300 border border-transparent ${isFavorite ? 'border-red-500 text-red-500 bg-transparent shadow-none' : 'text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5'}`}
                                    title="علاقه‌مندی‌ها"
                                >
                                    <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                                </button>
                                <button
                                    onClick={handleToggleReviewLater}
                                    className={`action-icon transition-all duration-300 border border-transparent ${isReviewLater ? 'border-violet-500 text-violet-500 bg-transparent shadow-none' : 'text-[var(--text-muted)] hover:text-violet-500 hover:border-violet-500/40 hover:bg-violet-500/5'}`}
                                    title="مرور مجدد"
                                >
                                    <Archive size={18} fill={isReviewLater ? "currentColor" : "none"} />
                                </button>
                                <button
                                    onClick={() => setIsNoteModalOpen(true)}
                                    className={`action-icon transition-all duration-300 border border-transparent ${noteText ? 'border-yellow-500 text-yellow-500 bg-transparent shadow-none' : 'text-[var(--text-muted)] hover:text-yellow-500 hover:border-yellow-500/40 hover:bg-yellow-500/5'}`}
                                    title="یادداشت"
                                >
                                    <FileText size={18} fill={noteText ? "currentColor" : "none"} />
                                </button>
                                <button onClick={() => setIsReportModalOpen(true)} className="action-icon" title="گزارش خطا">
                                    <AlertTriangle size={18} />
                                </button>
                                <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
                                <button onClick={() => setIsExitModalOpen(true)} className="action-icon text-red-500 hover:bg-red-50/50 hover:text-red-600" title="خروج">
                                    <Power size={18} />
                                </button>
                            </div>
                        </div>

                        {/* --- MOBILE LAYOUT --- */}
                        <div className="flex md:hidden items-center justify-between max-w-6xl mx-auto h-full px-4 relative" dir="rtl">
                            <div className="flex flex-col items-start justify-center overflow-hidden max-w-[60%]">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate w-full">
                                    {config?.title || 'تمرین'}
                                </span>
                                <span className="text-[9px] text-[var(--text-muted)] tracking-wider uppercase opacity-70">
                                    Quiz Mode
                                </span>
                            </div>

                            <div className="flex items-center justify-end">
                                <div className="relative z-50" ref={mobileMenuRef}>
                                    <button
                                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                        className={`flex items-center justify-center w-11 h-11 rounded-2xl border transition-all duration-300 p-0 ${
                                            isMobileMenuOpen
                                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20'
                                                : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-element)]'
                                        }`}
                                    >
                                        <MoreVertical size={19} />
                                    </button>

                                    <AnimatePresence>
                                        {isMobileMenuOpen && (
                                            <>
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
                                                />

                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.92, y: -10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.92, y: -10 }}
                                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                                    className="absolute top-[calc(100%+12px)] left-0 w-60 bg-[var(--bg-card)]/95 backdrop-blur-2xl border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden z-50"
                                                >
                                                    <div className="p-2 space-y-1">
                                                        <button
                                                            onClick={() => { handleToggleFavorite(); setIsMobileMenuOpen(false); }}
                                                            className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 w-full text-right ${
                                                                isFavorite ? 'bg-red-500/10 text-red-500' : 'hover:bg-[var(--bg-element)] text-[var(--text-primary)]'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                                                                <span className="font-semibold text-sm">علاقه‌مندی</span>
                                                            </div>
                                                            {isFavorite && <Check size={16} />}
                                                        </button>

                                                        <button
                                                            onClick={() => { handleToggleReviewLater(); setIsMobileMenuOpen(false); }}
                                                            className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 w-full text-right ${
                                                                isReviewLater ? 'bg-violet-500/10 text-violet-500' : 'hover:bg-[var(--bg-element)] text-[var(--text-primary)]'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Archive size={18} fill={isReviewLater ? "currentColor" : "none"} />
                                                                <span className="font-semibold text-sm">مرور مجدد</span>
                                                            </div>
                                                            {isReviewLater && <Check size={16} />}
                                                        </button>

                                                        <button
                                                            onClick={() => { setIsNoteModalOpen(true); setIsMobileMenuOpen(false); }}
                                                            className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 w-full text-right ${
                                                                noteText ? 'bg-yellow-500/10 text-yellow-500' : 'hover:bg-[var(--bg-element)] text-[var(--text-primary)]'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <FileText size={18} fill={noteText ? "currentColor" : "none"} />
                                                                <span className="font-semibold text-sm">یادداشت</span>
                                                            </div>
                                                            {noteText && <Check size={16} />}
                                                        </button>

                                                        <div className="h-px bg-[var(--border)] my-2" />

                                                        <button
                                                            onClick={() => { setIsReportModalOpen(true); setIsMobileMenuOpen(false); }}
                                                            className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 w-full text-right hover:bg-orange-500/10 text-[var(--text-primary)] hover:text-orange-500"
                                                        >
                                                            <AlertTriangle size={18} />
                                                            <span className="font-semibold text-sm">گزارش سوال</span>
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                toggleMute();
                                                            }}
                                                            className="flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 w-full text-right hover:bg-[var(--bg-element)] text-[var(--text-primary)]"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {isMuted ? <VolumeX size={18} className="text-[var(--text-muted)]" /> : <Volume2 size={18} />}
                                                                <span className="font-semibold text-sm">افکت صوتی</span>
                                                            </div>
                                                            <span className={`text-xs font-medium ${isMuted ? 'text-[var(--text-muted)]' : 'text-green-500'}`}>
        {isMuted ? 'خاموش' : 'روشن'}
    </span>
                                                        </button>


                                                        <button
                                                            onClick={() => { setIsExitModalOpen(true); setIsMobileMenuOpen(false); }}
                                                            className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 w-full text-right hover:bg-red-500/10 text-red-500"
                                                        >
                                                            <Power size={18} />
                                                            <span className="font-semibold text-sm">خروج از آزمون</span>
                                                        </button>


                                                    </div>

                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10" dir="ltr">
                                <div className="bg-[var(--bg-app)] border border-[var(--border)] shadow-sm rounded-full px-2.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] flex items-center justify-center min-w-[45px]">
                                    <QuestionTimer  seconds={quizElapsedSeconds} isLoading={!question} />
                                </div>
                                <div className="bg-[var(--bg-app)] border border-[var(--border)] shadow-sm rounded-full px-2.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] flex items-center justify-center min-w-[45px]">
                                    <QuestionCounter
                                        isLoading={!question}
                                        current={currentQuestionCount}
                                        total={totalQuestions}
                                    />
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Main */}
                    <main className="flex-1 w-full overflow-y-auto scrollbar-hide">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div
                                    key="skeleton"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    <QuizSkeleton />
                                </motion.div>
                            ) : question ? (
                                <motion.div
                                    key={`question-${question.id}-${historyIndex}`}
                                    ref={contentRef}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}

                                    transition={{ duration: 0.35, ease: "easeOut" }}
                                    className="w-full max-w-6xl mx-auto p-4 md:p-6"
                                >
                                    <QuestionGeneralInfo
                                        isLoading={isLoading}
                                        grade={question?.grade || 'نامشخص'}
                                        subject={question?.subject || '...'}
                                        chapter={question?.topic || '...'}
                                        lesson={question?.chapter || '...'}
                                        level={question?.difficulty_level || '...'}
                                    />

                                    {/* Question Text */}
                                    <div className="relative mb-6 md:mb-8 bg-[var(--bg-card)] border border-[var(--border)]/50 md:border-[var(--border)] shadow-sm md:shadow-md rounded-2xl md:rounded-3xl p-5 md:p-6 overflow-hidden transition-all duration-300">
                                        <div className="absolute top-0 right-0 w-1.5 md:w-1.5 h-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent)]/40"></div>
                                        <div className="absolute -top-4 -left-4 w-24 h-24 bg-[var(--accent)]/5 rounded-full blur-2xl md:hidden pointer-events-none"></div>

                                        <p
                                            dir="rtl"
                                            className="text-[16px] md:text-[19px] whitespace-pre-wrap font-semibold tracking-[-0.01em] leading-8 md:leading-10 text-right text-[var(--text-primary)] select-text"
                                        >
                                            <MathRenderer text={question.text} inline={true} subject={question.subject_id} />
                                        </p>
                                    </div>

                                    {/* Images */}
                                    {question.has_image && question.images?.length > 0 && (
                                        <div className="mb-6 grid gap-4">
                                            {question.images.map((img, idx) => (
                                                <div key={idx} className="relative rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm bg-white/5">
                                                    <img src={`${IMAGE_BASE}${img}`} alt="Question" className="w-full h-auto object-contain max-h-[300px]" loading="lazy" />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Options */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {question.options.map((opt, idx) => renderOption(opt, idx, 2))}
                                    </div>


                                    {/* Mobile Dynamic Stats */}
                                    {currentStats.length > 0 && (
                                        <div className="mt-6 md:hidden flex justify-center w-full m-auto">
                                            <QuestionStatsDisplay isLoading={!question} stats={currentStats} />
                                        </div>

                                    )}

                                    {/* Explanation */}
                                    <AnimatePresence>
                                        {isAnswered && descriptiveAnswer && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-8 p-6 md:p-7 rounded-3xl border border-[var(--border)] bg-[var(--bg-element)]/60 backdrop-blur-xl shadow-lg shadow-black/5"
                                            >
                                                <div className="flex items-center gap-2 mb-4 text-[var(--accent)] border-b border-[var(--border)] pb-3">
                                                    <Bookmark size={20} />
                                                    <span className="font-black tracking-tight text-lg">پاسخ تشریحی</span>
                                                </div>
                                                <div dir="rtl" className="whitespace-pre-wrap text-[var(--text-primary)] leading-9 md:leading-10 opacity-95 text-justify text-[15px] md:text-[17px] font-medium tracking-[-0.01em]">
                                                    <MathRenderer text={descriptiveAnswer} inline={true} subject={question.subject_id} />

                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {isAnswered && (
                                        <motion.button
                                            type="button"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => setMetOpen(true)}
                                            className="mt-6 w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border border-[var(--color-primary-500)]/30 bg-[color-mix(in_srgb,var(--color-primary-500)_10%,var(--bg-card))] text-[var(--color-primary-500)] font-extrabold text-[15px] active:scale-[0.99]"
                                        >
                                            <span className="w-8 h-8"><Met size="100%" state="idle" color="violet" /></span>
                                            از مِت درباره‌ی این سوال بپرس
                                        </motion.button>
                                    )}
                                </motion.div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-[var(--text-muted)] mt-20">خطا در دریافت سوال</div>
                            )}
                        </AnimatePresence>
                    </main>

                    {/* Footer action bar */}
                    <footer className="relative bottom-0 z-40 pointer-events-none app-fixed-shell">
                        <div className="w-full max-w-6xl mx-auto px-4 pb-4 md:pb-2 pointer-events-auto">
                            <div className="bg-[var(--bg-card)] md:bg-transparent border border-[var(--border)] md:border-none rounded-2xl md:rounded-none shadow-lg md:shadow-none p-2 md:p-0">
                                <div className="relative flex items-center justify-between min-h-[50px] w-full" dir="rtl">

                                    {/* RIGHT SIDE (Desktop Only): Dynamic Minimal Stats */}
                                    <div className="hidden md:flex items-center justify-start flex-shrink-0 w-auto min-w-[200px]">
                                        {currentStats.length > 0 && (
                                            <QuestionStatsDisplay stats={currentStats} minimal={true} />
                                        )}
                                    </div>

                                    {/* LEFT SIDE (Desktop) / CENTER (Mobile): Action Buttons & Result */}
                                    <div className="flex flex-1 items-center justify-center md:justify-end transition-all duration-500 ease-out w-full">
                                        <AnimatePresence mode="wait">
                                            {showButtons && (
                                                <motion.div
                                                    key="buttons"
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                                    className="flex w-full md:w-auto items-center justify-between md:justify-center gap-2 md:gap-3"
                                                >
                                                    <button
                                                        onClick={handlePrev}
                                                        disabled={historyIndex <= 0 || isLoading}
                                                        className="flex items-center justify-center gap-2 p-3 md:px-4 md:py-2 rounded-xl bg-[var(--bg-element)] hover:bg-[var(--border)] text-[var(--text-primary)] transition-colors min-w-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
                                                        aria-label="سوال قبلی"
                                                    >
                                                        <ArrowRight size={20} className="md:w-[18px] md:h-[18px]" />
                                                        <span className="hidden md:inline text-sm font-medium">قبلی</span>
                                                    </button>

                                                    <button
                                                        onClick={handleCheckAnswer}
                                                        disabled={!selectedOptionId || isChecking || isAnswered}
                                                        className="action-btn flex-1 md:flex-none flex items-center justify-center py-3 md:py-2 text-base md:text-sm shadow-md disabled:opacity-50"
                                                    >
                                                        ثبت پاسخ
                                                    </button>

                                                    <button
                                                        onClick={handleNext}
                                                        disabled={isLoading}
                                                        className="flex items-center justify-center gap-2 p-3 md:px-4 md:py-2 rounded-xl bg-[var(--bg-element)] hover:bg-[var(--border)] text-[var(--text-primary)] transition-colors min-w-[48px]"
                                                        aria-label="سوال بعدی"
                                                    >
                                                        <span className="hidden md:inline text-sm font-medium">بعدی</span>
                                                        <ArrowLeft size={20} className="md:w-[18px] md:h-[18px]" />
                                                    </button>
                                                </motion.div>
                                            )}

                                            {resultState && (
                                                <motion.div
                                                    key="result"
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.8, y: 15 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.8, y: -15 }}
                                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                                    className="result-pill shadow-lg w-full md:w-auto flex items-center justify-center py-3"
                                                >
                                                    {resultState === 'correct' ? (
                                                        <>
                                                            <CheckCircle2 className="text-green-500 w-6 h-6 md:w-7 md:h-7" />
                                                            <span className="text-green-600 font-extrabold text-base md:text-lg">
                                                                پاسخ درست
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="text-red-500 w-6 h-6 md:w-7 md:h-7" />
                                                            <span className="text-red-600 font-extrabold text-base md:text-lg">
                                                                پاسخ نادرست
                                                            </span>
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </footer>

                    <GameRewardToast
                        data={rewardData}
                        isOpen={isRewardToastOpen}
                        onClose={() => setIsRewardToastOpen(false)}
                    />

                    <QuizMetPanel
                        open={metOpen}
                        onClose={() => setMetOpen(false)}
                        questionId={isAnswered && question ? question.id : null}
                    />

                </>
            )}

            {/* Reusable Modals */}
            <ResponsiveModal
                isOpen={isExitModalOpen}
                onClose={handleExitCancel}
                title="خروج از آزمون"
                icon={<LogOut className="text-orange-500" size={22} />}
            >
                <div className="space-y-6">
                    <p className="text-[var(--text-muted)] text-base">آیا مطمئن هستید که می‌خواهید از این تمرین خارج شوید؟</p>
                    <div className="flex gap-3">
                        <button className="flex-1 btn btn-ghost py-3 bg-[var(--bg-element)] rounded-xl font-bold" onClick={handleExitCancel}>لغو</button>
                        <button className="flex-1 btn py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-bold transition-colors" onClick={handleExitConfirm}>بله، خروج</button>
                    </div>
                </div>
            </ResponsiveModal>

            {/* Report Modal */}
            <ResponsiveModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                title="گزارش خطای سوال"
                icon={<AlertTriangle className="text-orange-500" size={22} />}
            >
                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-primary)]">نوع مشکل</label>
                        <select
                            value={reportIssue}
                            onChange={(e) => setReportIssue(e.target.value)}
                            className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-element)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors appearance-none"
                        >
                            <option value="wrong_info">اطلاعات / پاسخ نادرست</option>
                            <option value="technical">مشکل فنی سیستم</option>
                            <option value="appearance">بهم‌ریختگی ظاهری / ناخوانا بودن</option>
                            <option value="other">سایر موارد</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-primary)]">توضیحات بیشتر</label>
                        <textarea
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            placeholder="لطفاً مشکل را توضیح دهید... (اختیاری)"
                            className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-element)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-28"
                        />
                    </div>

                    <button
                        onClick={submitReport}
                        className="w-full py-3.5 mt-2 bg-[var(--accent)] text-white rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center"
                    >
                        ارسال گزارش
                    </button>
                </div>
            </ResponsiveModal>

            {/* Note Modal */}
            <ResponsiveModal
                isOpen={isNoteModalOpen}
                onClose={() => setIsNoteModalOpen(false)}
                title="یادداشت برای این سوال"
                icon={<FileText className="text-yellow-500" size={22} />}
            >
                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-primary)]">متن یادداشت</label>
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="یادداشت خود را اینجا بنویسید..."
                            className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-element)] text-[var(--text-primary)] outline-none focus:border-yellow-500 transition-colors resize-none h-32 leading-loose"
                        />
                    </div>

                    <button
                        onClick={handleSaveNote}
                        className="w-full py-3.5 mt-2 bg-yellow-500 text-white rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center shadow-lg shadow-yellow-500/20"
                    >
                        ذخیره یادداشت
                    </button>
                </div>
            </ResponsiveModal>
        </div>
    );
}