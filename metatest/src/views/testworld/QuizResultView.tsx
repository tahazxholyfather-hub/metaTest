import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactToPrint } from 'react-to-print';
import PrintResultSheet from './PrintResultSheet';
import { toast, Toaster } from 'sonner';
import {
    Share2,
    Printer,
    LogOut,
    Clock3,
    BookOpenText,
    BarChart3,
    FolderKanban,
    CheckCheck,
    CircleX,
    BookOpen,
    TimerReset,
    Timer,
    AlertCircle,
    RefreshCcw,
    Trophy,
    ChevronLeft,
    ChevronRight,
    UserX
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

import {
    Card,
    SectionHeader,
    getStatusConfig,
    getLevelConfig,
    StatCard,
    ScoreCard,
    LessonCircleCard,
    QuestionSkeleton
} from './SharedComponents';

import MathRenderer, { loadMathJax } from '../../components/ui/MathRenderer';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import { clsx } from 'clsx';
import { flowApi } from '../../lib/authApi';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

// Helper to format total time spent dynamically
const formatTimeSpent = (seconds) => {
    if (seconds < 60) {
        return {
            value: String(seconds),
            unit: 'ثانیه'
        };
    } else {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return {
            value: secs > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : String(mins),
            unit: 'دقیقه'
        };
    }
};

// Member Slider Component
function MemberSlider({ members, activeMemberId, onSelectMember, loadingMemberId }) {
    const activeIndex = members.findIndex(m => m.id === activeMemberId);

    const handlePrev = () => {
        if (activeIndex === -1 || members.length <= 1) return;
        const prevIndex = (activeIndex - 1 + members.length) % members.length;
        onSelectMember(members[prevIndex].id);
    };

    const handleNext = () => {
        if (activeIndex === -1 || members.length <= 1) return;
        const nextIndex = (activeIndex + 1) % members.length;
        onSelectMember(members[nextIndex].id);
    };

    const getMedalColor = (rank) => {
        if (rank === 1) return 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]';
        if (rank === 2) return 'text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.6)]';
        if (rank === 3) return 'text-amber-600 drop-shadow-[0_0_6px_rgba(180,83,9,0.6)]';
        return null;
    };

    return (
        <div className="flex items-center gap-1.5 w-full select-none py-1">
            <button
                onClick={handlePrev}
                className="p-2 rounded-2xl hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shrink-0 active:scale-95"
                aria-label="قبلی"
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center justify-between gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth px-1 py-1 w-full">
                {members.map((member) => {
                    const isActive = member.id === activeMemberId;
                    const isLoading = member.id === loadingMemberId;
                    const medalColor = getMedalColor(member.rank);

                    return (
                        <button
                            key={member.id}
                            onClick={() => onSelectMember(member.id)}
                            disabled={isLoading}
                            className="flex flex-col items-center gap-1.5 shrink-0 relative focus:outline-none group flex-1 disabled:opacity-60"
                        >
                            <div className="relative">
                                <div
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 p-[2px]",
                                        isActive
                                            ? "bg-gradient-to-tr from-[var(--color-primary-500)] via-indigo-500 to-purple-500 scale-110 shadow-lg"
                                            : "bg-[var(--border)] group-hover:bg-[var(--text-muted)]"
                                    )}
                                >
                                    {isLoading ? (
                                        <div className="w-full h-full rounded-full bg-[var(--bg-card)] flex items-center justify-center">
                                            <div className="w-4 h-4 border-2 border-[var(--color-primary-500)] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <img
                                            src={member.avatar}
                                            alt={member.name}
                                            className="w-full h-full rounded-full object-cover bg-[var(--bg-card)] transition-all duration-300"
                                        />
                                    )}
                                </div>

                                {medalColor && (
                                    <div className="absolute -top-1 -right-1 bg-[var(--bg-card)] rounded-full p-0.5 border border-[var(--border)] flex items-center justify-center shadow-sm">
                                        <Trophy className={cn("w-3.5 h-3.5", medalColor)} />
                                    </div>
                                )}
                            </div>
                            <span
                                className={cn(
                                    "text-[10px] font-bold max-w-[60px] truncate transition duration-300",
                                    isActive ? "text-[var(--text-primary)] font-extrabold scale-105" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                                )}
                            >
                                {member.name}
                            </span>
                        </button>
                    );
                })}
            </div>

            <button
                onClick={handleNext}
                className="p-2 rounded-2xl hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shrink-0 active:scale-95"
                aria-label="بعدی"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
        </div>
    );
}

/* HIGH-FIDELITY SMOOTH SHIMMER SKELETON LOADERS */

const SliderSkeleton = () => (
    <div className="flex items-center gap-1.5 w-full select-none py-1 mb-6">
        <div className="p-2 rounded-2xl border border-[var(--border)] shrink-0 w-8 h-8 shimmer-bg" />
        <div className="flex-1 flex items-center justify-between gap-4 overflow-hidden px-1 py-1 w-full">
            {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 flex-1">
                    <div className="w-12 h-12 rounded-full border border-[var(--border)] shimmer-bg" />
                    <div className="w-10 h-2 rounded-full shimmer-bg" />
                </div>
            ))}
        </div>
        <div className="p-2 rounded-2xl border border-[var(--border)] shrink-0 w-8 h-8 shimmer-bg" />
    </div>
);

const ScoreCardSkeleton = () => (
    <Card className="p-5 md:p-6 h-[200px] border border-[var(--border)] rounded-3xl flex flex-col justify-between relative overflow-hidden bg-[var(--bg-card)]">
        <div className="flex items-center justify-between w-full">
            <div className="space-y-3">
                <div className="w-24 h-4 rounded-md shimmer-bg" />
                <div className="w-32 h-8 rounded-md shimmer-bg" />
            </div>
            <div className="w-20 h-20 rounded-full border-[6px] border-[var(--bg-elevated)] flex items-center justify-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 rounded-full shimmer-bg opacity-30" />
            </div>
        </div>
        <div className="flex gap-2">
            <div className="w-16 h-5 rounded-full shimmer-bg" />
            <div className="w-20 h-5 rounded-full shimmer-bg" />
        </div>
    </Card>
);

const StatCardSkeleton = () => (
    <Card className="p-4 h-[100px] border border-[var(--border)] rounded-3xl flex flex-col justify-between bg-[var(--bg-card)] overflow-hidden relative">
        <div className="flex items-center justify-between">
            <div className="w-12 h-3.5 rounded-md shimmer-bg" />
            <div className="w-6 h-6 rounded-lg shimmer-bg shrink-0" />
        </div>
        <div className="space-y-1.5">
            <div className="w-16 h-6 rounded-md shimmer-bg" />
            <div className="w-20 h-2.5 rounded-md shimmer-bg" />
        </div>
    </Card>
);

const PieChartSkeleton = () => (
    <Card className="p-5 md:p-6 min-h-[320px] flex flex-col justify-between bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl lg:col-span-1 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md shimmer-bg" />
            <div className="w-28 h-4 rounded-md shimmer-bg" />
        </div>
        <div className="flex-1 flex items-center justify-center py-4">
            <div className="w-[150px] h-[150px] rounded-full border-[16px] border-[var(--bg-elevated)] relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 rounded-full shimmer-bg opacity-25" />
            </div>
        </div>
        <div className="flex justify-center gap-2">
            <div className="w-14 h-6 rounded-full shimmer-bg" />
            <div className="w-14 h-6 rounded-full shimmer-bg" />
            <div className="w-14 h-6 rounded-full shimmer-bg" />
        </div>
    </Card>
);

const AreaChartSkeleton = () => (
    <Card className="p-5 md:p-6 min-h-[320px] flex flex-col justify-between bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl lg:col-span-2 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-md shimmer-bg" />
            <div className="w-36 h-4 rounded-md shimmer-bg" />
        </div>
        <div className="flex-1 flex flex-col justify-end gap-3 px-2 py-4">
            <div className="w-full h-[150px] relative shimmer-bg rounded-2xl opacity-40 overflow-hidden" />
            <div className="flex justify-between w-full px-1">
                {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="w-6 h-3 rounded shimmer-bg" />
                ))}
            </div>
        </div>
    </Card>
);

const LessonsGridSkeleton = () => (
    <Card className="p-5 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl relative overflow-hidden">
        <div className="flex items-center gap-2 mb-6">
            <div className="w-5 h-5 rounded-md shimmer-bg" />
            <div className="w-24 h-4 rounded-md shimmer-bg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array(4).fill(0).map((_, i) => (
                <div key={i} className="p-4 rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full border-[5px] border-[var(--bg-elevated)] relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full shimmer-bg opacity-30" />
                    </div>
                    <div className="w-20 h-4 rounded-md shimmer-bg" />
                    <div className="flex gap-2 w-full justify-center">
                        <div className="w-8 h-2 rounded shimmer-bg" />
                        <div className="w-8 h-2 rounded shimmer-bg" />
                    </div>
                </div>
            ))}
        </div>
    </Card>
);

const SidebarSkeleton = () => (
    <Card className="overflow-hidden xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl relative">
        <div className="border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 shrink-0 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl shimmer-bg" />
            <div className="w-24 h-5 rounded-md shimmer-bg" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {Array(4).fill(0).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full shimmer-bg" />
                            <div className="w-16 h-5 rounded-full shimmer-bg" />
                        </div>
                        <div className="w-14 h-5 rounded-full shimmer-bg" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="w-full h-3.5 rounded shimmer-bg" />
                        <div className="w-3/4 h-3.5 rounded shimmer-bg" />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-2">
                        {Array(4).fill(0).map((_, optIdx) => (
                            <div key={optIdx} className="w-6 h-6 rounded-full shimmer-bg" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </Card>
);

// Helper: map raw API result data into local state shape
function mapResultData(data) {
    const totalTimeInSeconds = Math.floor(data.total_time_spent || 0);

    const userInfo = {
        id: data.userId || data.id,
        name: data.userName || data.full_name || 'کاربر',
        score: data.score || 0,
        accuracy: parseFloat(data.accuracyRate) || 0,
        correct: data.correctCount || 0,
        wrong: data.incorrectCount || 0,
        unanswered: data.unansweredCount || 0,
        total: data.summary?.total_questions || 0,
        timeSeconds: totalTimeInSeconds
    };

    const evaluationData = data.resultData?.evaluation || {};
    const mappedQuestions = Object.entries(evaluationData)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([id, qData]) => ({
            id,
            text: qData.question_text || 'متن سوال نامشخص',
            status: qData.status || 'unanswered',
            level: qData.level || 'medium',
            topic: qData.mabhas || '',
            description: qData.descriptive_answer?.text || '',
            options: qData.options || [],
            selected: qData.selected_option_id ?? null,
            correctAnswer: qData.correct_option_id ?? null,
            time: Math.floor((qData.time_spent_ms || 0) / 1000),
            isAnswered: qData.is_answered ?? false,
        }));

    const mappedWaveData = mappedQuestions.map((q, idx) => ({
        name: ` س ${idx + 1}`,
        time: q.time
    }));

    const mappedLessons = Object.entries(data.summary?.mabhas_stats || {}).map(
        ([topicName, stats], index) => {
            const progress = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            return {
                id: index,
                title: topicName,
                progress,
                correct: stats.correct || 0,
                wrong: stats.incorrect || 0,
                unanswered: stats.unanswered || 0,
                total: stats.total || 0,
                icon: BookOpen
            };
        }
    );

    return { userInfo, mappedQuestions, mappedWaveData, mappedLessons };
}

const scrollResultsToTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
};


export default function ResultDashboard() {
    const { resultId: hashedresultId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPublic, setIsPublic] = useState(false);
    const [quizId, setQuizId] = useState(null);

    const [activeUser, setActiveUser] = useState(null);
    const [originalUser, setOriginalUser] = useState(null);

    const [questions, setQuestions] = useState([]);
    const [originalQuestions, setOriginalQuestions] = useState([]);

    const [lessonsData, setLessonsData] = useState([]);
    const [originalLessonsData, setOriginalLessonsData] = useState([]);

    const [waveChartData, setWaveChartData] = useState([]);
    const [originalWaveChartData, setOriginalWaveChartData] = useState([]);

    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const printRef = useRef(null);
    // Members state (only populated for public quizzes)
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [activeMemberId, setActiveMemberId] = useState(null);
    const [loadingMemberId, setLoadingMemberId] = useState(null);
    const [memberError, setMemberError] = useState(null);

    // ─── Leave: navigate to main dashboard ───────────────────────────────────
    const handleLeave = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    // ─── Print: navigate to print view with active user data ─────────────────
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'کارنامه آزمون',
        onBeforePrint: async () => {
            const node = printRef.current;
            if (!node) return;
            const loaded = await loadMathJax();
            if (!loaded || !window.MathJax?.typesetPromise) return;
            try {
                window.MathJax.typesetClear?.([node]);
                await window.MathJax.typesetPromise([node]);
            } catch (err) {
                console.error('Print MathJax typeset failed:', err);
            }
        },
    });

    // ─── Fetch quiz result (self) on mount ────────────────────────────────────
    const fetchResultData = useCallback(async () => {
        if (!hashedresultId) {
            setError('شناسه آزمون یافت نشد.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await flowApi.dispatch('get_quiz_result_by_id', {
                resultId: hashedresultId
            });

            const data = response?.result ?? response;

            if (data && (data.id || data.quizId)) {
                const { userInfo, mappedQuestions, mappedWaveData, mappedLessons } = mapResultData(data);

                // Override name: this is always "شما" for own result
                userInfo.name = 'شما';
                userInfo.isSelf = true;
                scrollResultsToTop();
                setActiveUser(userInfo);
                setOriginalUser(userInfo);
                setQuestions(mappedQuestions);
                setOriginalQuestions(mappedQuestions);
                setWaveChartData(mappedWaveData);
                setOriginalWaveChartData(mappedWaveData);
                setLessonsData(mappedLessons);
                setOriginalLessonsData(mappedLessons);

                // Determine if quiz is public and store quizId
                const resolvedQuizId = data.quizId || data.quiz_id;
                setQuizId(resolvedQuizId);
                const publicFlag = data.is_public ?? data.isPublic ?? false;
                setIsPublic(publicFlag);

            } else {
                setError(response?.message || 'دریافت اطلاعات آزمون با خطا مواجه شد.');
            }
        } catch (err) {
            console.error('Failed to fetch result:', err);
            setError('ارتباط با سرور برقرار نشد. لطفا اتصال اینترنت خود را بررسی کنید.');
        } finally {
            setLoading(false);
        }
    }, [hashedresultId]);

    useEffect(() => {
        fetchResultData();
    }, [fetchResultData]);

    useLayoutEffect(() => {
        scrollResultsToTop();
    }, [hashedresultId]);

    useEffect(() => {
        if (!loading) scrollResultsToTop();
    }, [loading, hashedresultId]);

    // ─── Fetch quiz members (only when quiz is public and user data exists) ──
    useEffect(() => {
        if (!isPublic || !quizId || !originalUser) return;

        const fetchMembers = async () => {
            setMembersLoading(true);
            try {
                const response = await flowApi.dispatch('get_quiz_members', { quizId });
                const data = response?.result ?? response;

                if (Array.isArray(data) && data.length > 0) {
                    const mapped = data.map((m, idx) => {
                        const mId = m.userId || m.id;
                        const isSelf = m.isSelf ?? (mId === originalUser.id);
                        return {
                            id: mId,
                            name: isSelf ? 'شما' : (m.fullName || m.name || 'کاربر'),
                            avatar: m.avatar || m.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.fullName || 'U')}&background=random`,
                            rank: m.rank ?? idx + 1,
                            isSelf,
                        };
                    });
                    setMembers(mapped);

                    // Auto-select self if exists, otherwise first member
                    const selfMember = mapped.find(m => m.isSelf);
                    setActiveMemberId(selfMember ? selfMember.id : mapped[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch members:', err);
            } finally {
                setMembersLoading(false);
            }
        };

        fetchMembers();
    }, [isPublic, quizId, originalUser]);

    // ─── Fetch another member's result when avatar clicked ───────────────────
    const handleSelectMember = useCallback(async (memberId) => {
        if (memberId === activeMemberId) return;

        const member = members.find(m => m.id === memberId);
        if (!member) return;

        // If clicking self, restore own result
        if (member.isSelf) {
            setActiveMemberId(memberId);
            setActiveUser(originalUser);
            setQuestions(originalQuestions);
            setWaveChartData(originalWaveChartData);
            setLessonsData(originalLessonsData);
            setMemberError(null);
            return;
        }

        setLoadingMemberId(memberId);
        setMemberError(null);

        try {
            const response = await flowApi.dispatch('get_quiz_result_by_user_and_quiz', {
                userId: memberId,
                quizId,
            });

            const data = response?.result ?? response;

            if (data && (data.id || data.quizId || data.userId || data.resultData)) {
                const { userInfo, mappedQuestions, mappedWaveData, mappedLessons } = mapResultData(data);
                userInfo.name = member.name;
                userInfo.avatar = member.avatar;

                setActiveMemberId(memberId);
                setActiveUser(userInfo);
                setQuestions(mappedQuestions);
                setWaveChartData(mappedWaveData);
                setLessonsData(mappedLessons);
            } else {
                // User hasn't finished the quiz
                setMemberError({
                    memberId,
                    name: member.name,
                    message: `${member.name} هنوز این آزمون را تمام نکرده است.`
                });
                setActiveMemberId(memberId);
            }
        } catch (err) {
            console.error('Failed to fetch member result:', err);
            setMemberError({
                memberId,
                name: member.name,
                message: `${member.name} هنوز این آزمون را تمام نکرده است.`
            });
            setActiveMemberId(memberId);
        } finally {
            setLoadingMemberId(null);
        }
    }, [activeMemberId, members, quizId, originalUser, originalQuestions, originalLessonsData, originalWaveChartData]);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('لینک در کلیپ‌بورد کپی شد!');
        } catch {
            toast.error('کپی لینک انجام نشد.');
        }
    };

    const totalQuestions = activeUser?.total || 1;
    const maxScore = 100;

    const scorePercentage = useMemo(
        () => (activeUser ? Math.round((activeUser.score / maxScore) * 100) : 0),
        [activeUser]
    );

    const correctPercent = activeUser ? Math.round((activeUser.correct / totalQuestions) * 100) : 0;
    const wrongPercent = activeUser ? Math.round((activeUser.wrong / totalQuestions) * 100) : 0;
    const unansweredPercent = activeUser ? Math.round((activeUser.unanswered / totalQuestions) * 100) : 0;

    const doughnutData = useMemo(
        () =>
            activeUser
                ? [
                    { name: 'درست', value: activeUser.correct, color: 'var(--success)' },
                    { name: 'نادرست', value: activeUser.wrong, color: 'var(--error)' },
                    { name: 'بی‌پاسخ', value: activeUser.unanswered, color: 'var(--warning)' },
                ]
                : [],
        [activeUser]
    );

    if (error && !loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-6" dir="rtl">
                <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-8 text-center flex flex-col items-center gap-6 shadow-lg">
                    <div className="w-20 h-20 bg-[color:rgba(185,28,28,0.1)] rounded-full flex items-center justify-center text-[var(--error)]">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">خطا در دریافت اطلاعات</h2>
                        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
                    </div>
                    <button
                        onClick={fetchResultData}
                        className="flex items-center gap-2 bg-[var(--color-primary-500)] text-white px-6 py-3 rounded-xl font-medium transition hover:bg-[var(--color-primary-600)]"
                    >
                        <RefreshCcw className="w-5 h-5" />
                        تلاش مجدد
                    </button>
                </div>
            </div>
        );
    }

    // Determine if we should show the member error panel instead of results
    const showMemberError = memberError && memberError.memberId === activeMemberId;

    return (
        <div className="min-h-full bg-[var(--bg-app)]" dir="rtl" style={{ overflowAnchor: 'none' }}>
            <div className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">

                <div className="mx-auto max-w-[1550px] p-0 sm:p-3 md:p-6 lg:p-8">

                    {/* Top Header */}
                    <motion.header
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-5 border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 w-full sm:border-y sm:rounded-3xl sm:border sm:px-6 sm:py-4"
                    >
                        <div className="flex items-center justify-between">
                            {/* Leave button → goes to /dashboard */}
                            <button
                                onClick={handleLeave}
                                className="inline-flex p-0 h-10 w-10 sm:h-11 sm:w-auto items-center justify-center gap-2 rounded-2xl bg-[color:rgba(185,28,28,0.12)] sm:px-4 text-sm font-semibold text-[var(--error)] transition hover:bg-[color:rgba(185,28,28,0.18)]"
                            >
                                <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">خروج</span>
                            </button>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    onClick={handleShare}
                                    className="inline-flex p-0 h-10 w-10 sm:h-11 sm:w-auto items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] sm:px-4 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--hover-overlay)]"
                                >
                                    <Share2 className="h-5 w-5 sm:h-4 sm:w-4 text-[var(--color-primary-400)]" />
                                    <span className="hidden sm:inline">اشتراک</span>
                                </button>

                                {/* Print → navigate to print route with data */}
                                <button
                                    onClick={handlePrint}
                                    disabled={!activeUser || loading}
                                    className="inline-flex p-0 h-10 w-10 sm:h-11 sm:w-auto items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] sm:px-4 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--hover-overlay)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Printer className="h-5 w-5 sm:h-4 sm:w-4 text-[var(--color-primary-400)]" />
                                    <span className="hidden sm:inline">چاپ</span>
                                </button>
                            </div>
                        </div>
                    </motion.header>

                    <div className="px-3 sm:px-0">
                        {loading ? (
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
                                <div className="flex min-w-0 flex-col gap-6">
                                    <SliderSkeleton />
                                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
                                        <ScoreCardSkeleton />
                                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                                            {Array(4).fill(0).map((_, i) => (
                                                <StatCardSkeleton key={i} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                        <PieChartSkeleton />
                                        <AreaChartSkeleton />
                                    </div>
                                    <LessonsGridSkeleton />
                                </div>
                                <div className="min-w-0">
                                    <SidebarSkeleton />
                                </div>
                            </div>
                        ) : (
                            <motion.div
                                variants={containerVars}
                                initial="hidden"
                                animate="show"
                                className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]"
                            >
                                <div className="flex min-w-0 flex-col gap-6">

                                    {/* Member Slider — only shown for public quizzes */}
                                    {isPublic && (
                                        <div className="flex flex-col gap-2 w-full">
                                            {membersLoading ? (
                                                <SliderSkeleton />
                                            ) : members.length > 0 ? (
                                                <MemberSlider
                                                    members={members}
                                                    activeMemberId={activeMemberId}
                                                    onSelectMember={handleSelectMember}
                                                    loadingMemberId={loadingMemberId}
                                                />
                                            ) : null}
                                        </div>
                                    )}

                                    {/* Member hasn't finished quiz error state */}
                                    {showMemberError ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col items-center justify-center gap-6 py-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl"
                                        >
                                            <div className="w-20 h-20 bg-[color:rgba(245,158,11,0.1)] rounded-full flex items-center justify-center text-[var(--warning)]">
                                                <UserX className="w-10 h-10" />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                                                    نتیجه‌ای یافت نشد
                                                </h3>
                                                <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                                                    {memberError.message}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={activeUser?.id || 'skeleton'}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex flex-col gap-6"
                                            >
                                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
                                                    <ScoreCard
                                                        totalScore={activeUser.score}
                                                        maxScore={maxScore}
                                                        scorePercentage={scorePercentage}
                                                        topics={lessonsData.map((item) => item.title)}
                                                    />

                                                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                                                        <StatCard
                                                            title="درست"
                                                            percent={`${correctPercent}%`}
                                                            count={`${activeUser.correct} / ${totalQuestions}`}
                                                            tone="success"
                                                            icon={CheckCheck}
                                                        />
                                                        <StatCard
                                                            title="نادرست"
                                                            percent={`${wrongPercent}%`}
                                                            count={`${activeUser.wrong} / ${totalQuestions}`}
                                                            tone="error"
                                                            icon={CircleX}
                                                        />
                                                        <StatCard
                                                            title="بی‌پاسخ"
                                                            percent={`${unansweredPercent}%`}
                                                            count={`${activeUser.unanswered} / ${totalQuestions}`}
                                                            tone="warning"
                                                            icon={TimerReset}
                                                        />
                                                        {(() => {
                                                            const timeInfo = formatTimeSpent(activeUser.timeSeconds || 0);
                                                            return (
                                                                <StatCard
                                                                    title="زمان کل"
                                                                    percent={timeInfo.value}
                                                                    count={timeInfo.unit}
                                                                    tone="primary"
                                                                    icon={Timer}
                                                                />
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                                    <Card className="p-5 md:p-6 lg:col-span-1 min-h-[320px]">
                                                        <SectionHeader title="وضعیت پاسخ‌گویی" icon={BarChart3} />
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            whileInView={{ opacity: 1, scale: 1 }}
                                                            viewport={{ once: true }}
                                                            transition={{ duration: 0.5 }}
                                                            className="h-[220px]"
                                                        >
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <PieChart>
                                                                    <Pie
                                                                        data={doughnutData}
                                                                        innerRadius={62}
                                                                        outerRadius={86}
                                                                        paddingAngle={4}
                                                                        dataKey="value"
                                                                        stroke="none"
                                                                    >
                                                                        {doughnutData.map((entry, index) => (
                                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                                        ))}
                                                                    </Pie>
                                                                    <Tooltip
                                                                        contentStyle={{
                                                                            borderRadius: '16px',
                                                                            border: '1px solid var(--border)',
                                                                            backgroundColor: 'var(--bg-card)',
                                                                            color: 'var(--text-primary)',
                                                                            padding: '0.75rem',
                                                                            boxShadow: 'var(--shadow-1)',
                                                                        }}
                                                                        labelStyle={{ color: 'var(--text-muted)' }}
                                                                        itemStyle={{ color: 'var(--text-primary)' }}
                                                                    />
                                                                </PieChart>
                                                            </ResponsiveContainer>
                                                        </motion.div>

                                                        <div className="mt-4 flex flex-wrap justify-center gap-3">
                                                            {doughnutData.map((item) => (
                                                                <div
                                                                    key={item.name}
                                                                    className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5"
                                                                >
                                                                    <span
                                                                        className="h-2.5 w-2.5 rounded-full"
                                                                        style={{ backgroundColor: item.color }}
                                                                    />
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                                                        {item.name}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </Card>

                                                    <Card className="p-5 md:p-6 lg:col-span-2 min-h-[320px]">
                                                        <SectionHeader title="زمان صرف شده برای هر سوال" icon={Clock3} />
                                                        {waveChartData.length > 0 && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 20 }}
                                                                whileInView={{ opacity: 1, y: 0 }}
                                                                viewport={{ once: true }}
                                                                transition={{ duration: 0.5 }}
                                                                className="h-[250px] w-full"
                                                            >
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={waveChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                                                        <defs>
                                                                            <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="5%" stopColor="var(--color-secondary-500)" stopOpacity={0.28} />
                                                                                <stop offset="95%" stopColor="var(--color-secondary-500)" stopOpacity={0.02} />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid
                                                                            strokeDasharray="3 3"
                                                                            vertical={false}
                                                                            stroke="var(--border)"
                                                                            strokeOpacity={0.5}
                                                                        />
                                                                        <XAxis
                                                                            dataKey="name"
                                                                            axisLine={false}
                                                                            tickLine={false}
                                                                            tick={{ fontSize: 12, fill: 'var(--text-muted)', fontFamily: 'inherit' }}
                                                                            dy={10}
                                                                        />
                                                                        <YAxis
                                                                            axisLine={false}
                                                                            tickLine={false}
                                                                            tick={{ fontSize: 12, fill: 'var(--text-muted)', fontFamily: 'inherit' }}
                                                                            dx={-10}
                                                                            orientation="right"
                                                                        />
                                                                        <Tooltip
                                                                            contentStyle={{
                                                                                borderRadius: '16px',
                                                                                backgroundColor: 'var(--bg-card)',
                                                                                border: '1px solid var(--border)',
                                                                                color: 'var(--text-primary)',
                                                                                direction: 'rtl',
                                                                                padding: '0.75rem',
                                                                                boxShadow: 'var(--shadow-1)',
                                                                            }}
                                                                            labelStyle={{ color: 'var(--text-muted)' }}
                                                                            itemStyle={{ color: 'var(--text-primary)' }}
                                                                        />
                                                                        <Area
                                                                            type="monotone"
                                                                            dataKey="time"
                                                                            name="زمان (ثانیه)"
                                                                            stroke="var(--color-secondary-500)"
                                                                            strokeWidth={3}
                                                                            fillOpacity={1}
                                                                            fill="url(#colorTime)"
                                                                        />
                                                                    </AreaChart>
                                                                </ResponsiveContainer>
                                                            </motion.div>
                                                        )}
                                                    </Card>
                                                </div>

                                                <Card className="p-5 md:p-6">
                                                    <SectionHeader title="عملکرد دروس" icon={FolderKanban} />
                                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                        {lessonsData.map((lesson) => (
                                                            <LessonCircleCard
                                                                key={lesson.id}
                                                                title={lesson.title}
                                                                progress={lesson.progress}
                                                                correct={lesson.correct}
                                                                wrong={lesson.wrong}
                                                                unanswered={lesson.unanswered}
                                                            />
                                                        ))}
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        </AnimatePresence>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <Card className="overflow-hidden xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)] flex flex-col">
                                        <div className="border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                                                    <BookOpenText className="h-5 w-5 text-[var(--color-primary-400)]" />
                                                </div>
                                                <h2 className="text-lg font-bold text-[var(--text-primary)]">لیست سوالات</h2>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                            {showMemberError ? (
                                                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-[var(--text-muted)] gap-2">
                                                    <UserX className="w-8 h-8 opacity-60 text-[var(--text-muted)]" />
                                                    <p className="text-sm font-semibold">اطلاعات سوالات برای این کاربر در دسترس نیست.</p>
                                                </div>
                                            ) : questions.length === 0 ? (
                                                Array(5).fill(0).map((_, i) => <QuestionSkeleton key={i} />)
                                            ) : (
                                                questions.map((q, index) => {
                                                    const validStatuses = ['correct', 'wrong', 'unanswered'];
                                                    const currentstatus = validStatuses.includes(q.status) ? q.status : 'unanswered';
                                                    const status = getStatusConfig(currentstatus);

                                                    const levelConfig = getLevelConfig(q.level);
                                                    const StatusIcon = status.icon;
                                                    const LevelIcon = levelConfig.icon;
                                                    const displayId = index + 1;

                                                    return (
                                                        <motion.div
                                                            key={q.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            whileInView={{ opacity: 1, y: 0 }}
                                                            viewport={{ once: true, margin: '-20px' }}
                                                            onClick={() => setSelectedQuestion({ ...q, displayId })}
                                                            className="cursor-pointer group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--color-primary-500)] hover:shadow-md"
                                                        >
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-sm font-black text-[var(--text-primary)] shadow-sm border border-[var(--border)]">
                                                                            {displayId}
                                                                        </div>
                                                                        <div
                                                                            className={cn(
                                                                                'flex items-center gap-1 rounded-full bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-bold border border-[var(--border)]',
                                                                                levelConfig.color
                                                                            )}
                                                                        >
                                                                            <LevelIcon className="w-3 h-3" />
                                                                            {levelConfig.label}
                                                                        </div>
                                                                    </div>
                                                                    <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold', status.soft)}>
                                                                        <StatusIcon className="h-3 w-3" />
                                                                        {status.label}
                                                                    </div>
                                                                </div>

                                                                <div className="line-clamp-2 text-sm text-white font-medium">
                                                                    <MathRenderer text={q.text} inline={true} />
                                                                </div>

                                                                <div className="flex items-center justify-end gap-1.5 mt-2">
                                                                    {q.options.map((opt, optIndex) => {
                                                                        let bgClass = 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]';

                                                                        if (q.status !== 'unanswered') {
                                                                            if (opt.id === q.correctAnswer) {
                                                                                bgClass = 'bg-[color:rgba(21,128,61,0.15)] border-[var(--success)] text-[var(--success)]';
                                                                            } else if (opt.id === q.selected) {
                                                                                bgClass = 'bg-[color:rgba(185,28,28,0.15)] border-[var(--error)] text-[var(--error)]';
                                                                            }
                                                                        }

                                                                        return (
                                                                            <div
                                                                                key={opt.id}
                                                                                className={cn(
                                                                                    'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold',
                                                                                    bgClass
                                                                                )}
                                                                            >
                                                                                {optIndex + 1}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                <ResponsiveModal
                    isOpen={!!selectedQuestion}
                    onClose={() => setSelectedQuestion(null)}
                    title={
                        selectedQuestion ? (
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-sm font-black text-[var(--text-primary)]">
                                    {selectedQuestion.displayId}
                                </div>
                                <span>مشاهده سوال</span>
                            </div>
                        ) : null
                    }
                >
                    {selectedQuestion && (
                        <div className="space-y-6 pb-4">
                            <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
                                <MathRenderer
                                    text={selectedQuestion.text}
                                    className="text-sm md:text-base font-medium leading-8 text-[var(--text-primary)]"
                                    inline={true}
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {(() => {
                                    const validStatuses = ['correct', 'wrong', 'unanswered'];
                                    const currentStatus = validStatuses.includes(selectedQuestion.status)
                                        ? selectedQuestion.status
                                        : 'unanswered';
                                    const status = getStatusConfig(currentStatus);
                                    const StatusIcon = status.icon;

                                    return (
                                        <div
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
                                                status.soft
                                            )}
                                        >
                                            <StatusIcon className="h-4 w-4" />
                                            {status.label}
                                        </div>
                                    );
                                })()}

                                <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                                    <Clock3 className="h-4 w-4" />
                                    {selectedQuestion.time} ثانیه
                                </div>

                                {selectedQuestion.topic && (
                                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                                        <BookOpen className="h-4 w-4" />
                                        {selectedQuestion.topic}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    گزینه‌ها
                                </h4>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {selectedQuestion.options.map((opt) => {
                                        const isSelected = selectedQuestion.selected === opt.id;
                                        const isCorrect = selectedQuestion.correctAnswer === opt.id;

                                        return (
                                            <div
                                                key={opt.id}
                                                className={cn(
                                                    'relative flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium transition',
                                                    isCorrect
                                                        ? 'border-[color:rgba(21,128,61,0.4)] bg-[color:rgba(21,128,61,0.08)]'
                                                        : isSelected
                                                            ? 'border-[color:rgba(185,28,28,0.4)] bg-[color:rgba(185,28,28,0.08)]'
                                                            : 'border-[var(--border)] bg-[var(--bg-card)]'
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                                                        isCorrect
                                                            ? 'border-[var(--success)]'
                                                            : isSelected
                                                                ? 'border-[var(--error)]'
                                                                : 'border-[var(--border)]'
                                                    )}
                                                >
                                                    {(isSelected || isCorrect) && (
                                                        <div
                                                            className={cn(
                                                                'w-2.5 h-2.5 rounded-full',
                                                                isCorrect ? 'bg-[var(--success)]' : 'bg-[var(--error)]'
                                                            )}
                                                        />
                                                    )}
                                                </div>

                                                <span
                                                    className={cn(
                                                        'flex-1',
                                                        isCorrect
                                                            ? 'text-[var(--success)] font-bold'
                                                            : isSelected
                                                                ? 'text-[var(--error)]'
                                                                : 'text-[var(--text-primary)]'
                                                    )}
                                                >
                                                    <MathRenderer text={opt.text} inline={true} />
                                                </span>

                                                <div className="flex flex-col items-end gap-1">
                                                    {isCorrect && (
                                                        <span className="rounded-md bg-[color:rgba(21,128,61,0.15)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
                                                            صحیح
                                                        </span>
                                                    )}
                                                    {isSelected && !isCorrect && (
                                                        <span className="rounded-md bg-[color:rgba(185,28,28,0.15)] px-2 py-0.5 text-[10px] font-bold text-[var(--error)]">
                                                            پاسخ شما
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedQuestion.description && (
                                <div className="mt-4 rounded-2xl bg-[color:rgba(59,130,246,0.05)] p-5 border border-[color:rgba(59,130,246,0.2)]">
                                    <h4 className="text-sm font-bold text-[var(--color-primary-500)] mb-3 flex items-center gap-2">
                                        <BookOpenText className="w-4 h-4" />
                                        پاسخ تشریحی
                                    </h4>
                                    <MathRenderer
                                        text={selectedQuestion.description}
                                        className="text-sm font-medium leading-7 text-[var(--text-secondary)]"
                                        inline={true}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </ResponsiveModal>

                <div
                    aria-hidden="true"
                    className="pointer-events-none"
                    style={{
                        position: 'absolute',
                        left: '-12000px',
                        top: 0,
                        width: '210mm',
                        visibility: 'hidden',
                    }}
                >
                    <div ref={printRef}>
                        <PrintResultSheet
                            activeUser={activeUser}
                            questions={questions}
                            lessonsData={lessonsData}
                            quizTitle="کارنامه آزمون"
                        />
                    </div>
                </div>

                <style>{`
                  .math-renderer .mjx-chtml {
                    font-family: inherit !important;
                    font-size: 1em !important;
                    color: inherit !important;
                  }
                  @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                  .shimmer-bg {
                    background: linear-gradient(
                      90deg,
                      var(--bg-elevated) 25%,
                      var(--border) 37%,
                      var(--bg-elevated) 63%
                    );
                    background-size: 400% 100%;
                    animation: shimmer 1.4s ease-in-out infinite;
                  }
                `}</style>
            </div>
        </div>

    );
}