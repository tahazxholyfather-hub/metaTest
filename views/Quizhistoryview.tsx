import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, History, ChevronLeft, Target, Clock,
    Award, CheckCircle2, XCircle, MinusCircle, Calendar,
    Loader2, AlertTriangle, ArrowUpRight, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { flowApi } from '../lib/authApi';

// ─── Types ────────────────────────────────────────────────────────────────────
// Shape returned by GET /quiz-history (or whatever endpoint flowApi.dispatch
// resolves). This mirrors `quizzes` joined with `quiz_results` — adjust field
// names below to match the real API response if they differ.

type QuizStatus = 'waiting' | 'in_progress' | 'completed';
type QuizDifficulty = 1 | 2 | 3; // 1: آسان, 2: متوسط, 3: سخت

interface QuizHistoryItem {
    resultId: string | number; // encrypted id for /result/:resultId
    quizId: number;            // quizzes.id
    title: string;             // quizzes.title
    quizType: string | null;   // quizzes.quiz_type
    difficulty: QuizDifficulty;// quizzes.difficulty
    status: QuizStatus;        // quizzes.status
    accuracyRate: number;      // quiz_results.accuracy_rate (0-100)
    correctCount: number;      // quiz_results.correct_count
    incorrectCount: number;    // quiz_results.incorrect_count
    unansweredCount: number;   // quiz_results.unanswered_count
    totalScore: number;        // quiz_results.total_score
    totalTimeSpent: number;    // quiz_results.total_time_spent (seconds)
    createdAt: string;         // quiz_results.created_at (raw, for sorting)
    date: string;              // formatted fa-IR date, derived after fetch
}

type FilterOption = 'all' | 'high' | 'low'; // simple performance filter: all / accuracy >= 70 / accuracy < 50

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDifficultyConfig = (difficulty: QuizDifficulty) => {
    switch (difficulty) {
        case 1: return { label: 'آسان', classes: 'text-emerald-700 bg-emerald-50 border-emerald-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' };
        case 3: return { label: 'سخت', classes: 'text-rose-700 bg-rose-50 border-rose-200/60 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' };
        case 2:
        default: return { label: 'متوسط', classes: 'text-amber-700 bg-amber-50 border-amber-200/60 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400' };
    }
};

const getAccuracyClasses = (accuracy: number) => {
    if (accuracy >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400';
    if (accuracy >= 40) return 'text-amber-700 bg-amber-50 border-amber-200/60 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400';
    return 'text-rose-700 bg-rose-50 border-rose-200/60 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400';
};

// total_time_spent is stored in seconds; format as "۱۲ دقیقه" / "۴۵ ثانیه" / "۱ ساعت ۵ دقیقه"
const formatTimeSpent = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours} ساعت ${minutes} دقیقه`;
    if (minutes > 0) return `${minutes} دقیقه`;
    return `${seconds} ثانیه`;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface QuizHistoryViewProps {
    onBack: () => void;
    onStateChange?: (state: { title: string; showBackButton: boolean }) => void;
}

export function QuizHistoryView({ onBack, onStateChange }: QuizHistoryViewProps) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');

    // Keep the global header in sync with this view
    useEffect(() => {
        onStateChange?.({ title: 'سوابق آزمون‌ها', showBackButton: true });
    }, [onStateChange]);

    const handleViewResult = (resultId: string | number) => {
        navigate(`/result/${encodeURIComponent(String(resultId))}`);
    };

    // --- API States ---
    const [history, setHistory] = useState<QuizHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Fetch Data ---
    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await flowApi.dispatch('get_quiz_history');
                if (response.success) {
                    // Map API response -> QuizHistoryItem, formatting the date once here
                    // rather than on every render.
                    const mapped: QuizHistoryItem[] = response.data.map((r: any) => ({
                        resultId: r.resultId ?? r.id,
                        quizId: r.quizId ?? r.quiz_id,
                        title: r.title || 'آزمون سفارشی',
                        quizType: r.quizType ?? r.quiz_type ?? null,
                        difficulty: (r.difficulty ?? 2) as QuizDifficulty,
                        status: r.status ?? 'completed',
                        accuracyRate: Number(r.accuracyRate ?? r.accuracy_rate ?? 0),
                        correctCount: Number(r.correctCount ?? r.correct_count ?? 0),
                        incorrectCount: Number(r.incorrectCount ?? r.incorrect_count ?? 0),
                        unansweredCount: Number(r.unansweredCount ?? r.unanswered_count ?? 0),
                        totalScore: Number(r.totalScore ?? r.total_score ?? 0),
                        totalTimeSpent: Number(r.totalTimeSpent ?? r.total_time_spent ?? 0),
                        createdAt: r.createdAt ?? r.created_at,
                        date: new Date(r.createdAt ?? r.created_at).toLocaleDateString('fa-IR'),
                    }));
                    setHistory(mapped);
                } else {
                    setError(response.message || 'خطا در دریافت تاریخچه آزمون‌ها');
                }
            } catch (err: any) {
                setError(err.message || 'خطای شبکه در ارتباط با سرور');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const processedHistory = useMemo(() => {
        let result = history.filter(h =>
            h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (h.quizType && h.quizType.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (filterBy === 'high') result = result.filter(h => h.accuracyRate >= 70);
        if (filterBy === 'low') result = result.filter(h => h.accuracyRate < 40);

        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [history, searchQuery, filterBy]);

    // Light, single group fade keyed on the filter only — typing in search
    // updates the rows in place without retriggering the fade.
    const rowsKey = `rows-${filterBy}`;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">

                    {/* Header Section */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex lg:hidden items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-[var(--color-primary-500)]/10 text-[var(--color-primary-500)] flex items-center justify-center shrink-0">
                                    <History size={22} />
                                </div>
                                <h1 className="text-xl font-black text-[var(--text-primary)]">تاریخچه آزمون‌ها</h1>
                            </div>
                            <button
                                onClick={onBack}
                                className="w-10 p-0 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors">
                                <ChevronLeft size={26} strokeWidth={2.5} className="mr-0.5" />
                            </button>
                        </div>

                        <div className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
                            <div className="flex items-center w-full lg:w-auto p-1.5 bg-[var(--bg-element)]/60 border border-[var(--border)]/50 rounded-2xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {(Object.entries({ all: 'همه', high: 'موفق', low: 'ضعیف' }) as [FilterOption, string][]).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilterBy(key)}
                                        className="relative px-5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-colors duration-300 flex-1 lg:flex-none text-center">
                                        {filterBy === key && (
                                            <motion.div
                                                layoutId="activeHistoryFilterIndicator"
                                                className="absolute inset-0 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]"
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className={`relative z-10 ${filterBy === key ? 'text-[var(--color-primary-600)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-full lg:w-80">
                                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                <input
                                    type="text" placeholder="جستجو در عنوان آزمون..." value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-12 bg-[var(--bg-element)]/30 border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-2xl pr-11 pl-4 focus:outline-none focus:bg-[var(--bg-card)] focus:border-[var(--color-primary-500)] focus:ring-4 focus:ring-[var(--color-primary-500)]/10 transition-all duration-300 placeholder:text-[var(--text-muted)]"
                                />
                            </div>
                        </div>

                        <button onClick={onBack}
                                className="hidden lg:flex group items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300">
                            <span className="text-sm font-bold">بازگشت</span>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] group-hover:bg-[var(--color-primary-500)] group-hover:text-white transition-colors duration-300 border border-[var(--border)] group-hover:border-transparent">
                                <ChevronLeft size={26} strokeWidth={2.5} className="mr-0.5 group-hover:-translate-x-0.5 transition-transform duration-300" />
                            </div>
                        </button>
                    </div>

                    {/* Main Content Area: Loading / Error / Data / Empty */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Loader2 size={32} className="animate-spin text-[var(--color-primary-500)] mb-4" />
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">در حال دریافت تاریخچه...</h3>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center bg-rose-50/50 dark:bg-rose-500/5 rounded-3xl border border-rose-200 dark:border-rose-500/20 border-dashed">
                            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mb-5">
                                <AlertTriangle size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2">مشکلی پیش آمد</h3>
                            <p className="text-xs text-rose-500 dark:text-rose-300 max-w-xs leading-relaxed">{error}</p>
                        </div>
                    ) : processedHistory.length > 0 ? (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                <table className="w-full text-right min-w-[1000px] border-collapse">
                                    <thead>
                                    <tr className="bg-[var(--bg-element)]/50 border-b border-[var(--border)] text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4">عنوان آزمون</th>
                                        <th className="px-6 py-4">سطح</th>
                                        <th className="px-6 py-4 text-center">دقت</th>
                                        <th className="px-6 py-4 text-center">پاسخ‌ها</th>
                                        <th className="px-6 py-4 text-center">امتیاز</th>
                                        <th className="px-6 py-4 text-center">زمان</th>
                                        <th className="px-6 py-4">تاریخ</th>
                                        <th className="px-6 py-4 text-center">جزئیات</th>
                                    </tr>
                                    </thead>
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.tbody
                                            key={rowsKey}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.18, ease: 'easeOut' }}
                                            className="divide-y divide-[var(--border)]"
                                        >
                                            {processedHistory.map((item) => {
                                                const difficulty = getDifficultyConfig(item.difficulty);
                                                const accuracyClasses = getAccuracyClasses(item.accuracyRate);

                                                return (
                                                    <tr
                                                        key={item.resultId}
                                                        className="hover:bg-[var(--bg-element)]/30 transition-colors duration-200"
                                                    >
                                                        {/* Title + type */}
                                                        <td className="px-6 py-5 align-top min-w-[220px]">
                                                            <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed line-clamp-1">
                                                                {item.title}
                                                            </p>
                                                            {item.quizType && (
                                                                <span className="text-[11px] text-[var(--text-muted)] font-medium">{item.quizType}</span>
                                                            )}
                                                        </td>

                                                        {/* Difficulty */}
                                                        <td className="px-6 py-5 align-top">
                                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${difficulty.classes}`}>
                                                                <BarChart3 size={14} strokeWidth={2.5} />
                                                                <span>{difficulty.label}</span>
                                                            </div>
                                                        </td>

                                                        {/* Accuracy */}
                                                        <td className="px-6 py-5 align-top text-center">
                                                            <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold min-w-[70px] ${accuracyClasses}`}>
                                                                <Target size={13} />
                                                                <span dir="ltr">{item.accuracyRate.toFixed(0)}٪</span>
                                                            </div>
                                                        </td>

                                                        {/* Correct / Incorrect / Unanswered */}
                                                        <td className="px-6 py-5 align-top text-center">
                                                            <div className="flex items-center justify-center gap-3 text-xs font-bold">
                                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                    <CheckCircle2 size={14} />{item.correctCount}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                                                    <XCircle size={14} />{item.incorrectCount}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-[var(--text-muted)]">
                                                                    <MinusCircle size={14} />{item.unansweredCount}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Score */}
                                                        <td className="px-6 py-5 align-top text-center">
                                                            <div className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--color-primary-600)]">
                                                                <Award size={14} />
                                                                <span>{item.totalScore.toLocaleString('fa-IR')}</span>
                                                            </div>
                                                        </td>

                                                        {/* Time spent */}
                                                        <td className="px-6 py-5 align-top text-center whitespace-nowrap">
                                                            <div className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                                                                <Clock size={14} />
                                                                <span>{formatTimeSpent(item.totalTimeSpent)}</span>
                                                            </div>
                                                        </td>

                                                        {/* Date */}
                                                        <td className="px-6 py-5 align-top whitespace-nowrap">
                                                            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                                                                <Calendar size={14} />
                                                                <span>{item.date}</span>
                                                            </div>
                                                        </td>

                                                        {/* Result button */}
                                                        <td className="px-6 py-5 align-top text-center">
                                                            <button
                                                                onClick={() => handleViewResult(item.resultId)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary-500)]/10 text-[var(--color-primary-600)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors duration-200"
                                                            >
                                                                <span>مشاهده</span>
                                                                <ArrowUpRight size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </motion.tbody>
                                    </AnimatePresence>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-element)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                                <History size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">آزمونی یافت نشد</h3>
                            <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                                {searchQuery || filterBy !== 'all'
                                    ? 'نتیجه‌ای برای جستجو یا فیلتر فعلی یافت نشد.'
                                    : 'شما هنوز در هیچ آزمونی شرکت نکرده‌اید.'}
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}