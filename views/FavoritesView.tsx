import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, Heart, Trash2, Eye,
    CheckCheck, Copy, BookOpen, Layers,
    GraduationCap, Calendar, Clock,
    ChevronLeft, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveModal } from '../components/ResponsiveModal';
import { flowApi } from '../lib/authApi';

// --- Types ---
type Difficulty = 'easy' | 'medium' | 'hard';
type SortOption = 'newest' | 'oldest' | 'lesson';

interface Question {
    id: number;
    text: string;
    image?: string;
    options: string[];
    correctAnswerIndex: number;
    descriptiveAnswer: string;
    difficulty: Difficulty;
    date: string;
    timestamp: number;
    lesson: string;
    subject: string;
    chapter: string;
    grade: string;
}

// --- Animations ---
const springConfig = { type: "spring", stiffness: 300, damping: 25 };

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: springConfig },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

// --- Helpers ---
const getDifficultyConfig = (diff: Difficulty) => {
    switch (diff) {
        case 'easy': return { label: 'آسان', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/20' };
        case 'medium': return { label: 'متوسط', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/20' };
        case 'hard': return { label: 'سخت', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20' };
        default: return { label: 'نامشخص', color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
    }
};

interface FavoritesViewProps {
    onBack: () => void;
    onStateChange?: (state: any) => void;
}

export function FavoritesView({ onBack, onStateChange }: FavoritesViewProps) {
    // API States
    const [favorites, setFavorites] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>('newest');

    // Modal State
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    // Fetch Data on Mount
    // Fetch Data on Mount
    useEffect(() => {
        let isMounted = true;

        const fetchFavorites = async () => {
            try {
                setIsLoading(true);
                const response = await flowApi.dispatch('get_favorites');
                if (response.success && isMounted) {

                    // مپ کردن دیتای بک‌اند به اینترفیس فرانت‌اند
                    const rawData = response.data || [];
                    const formattedData: Question[] = rawData.map((item: any) => {

                        // تبدیل سطح دشواری به فرمت استاندارد
                        let diff: Difficulty = 'medium';
                        if (item.difficulty_level === 'آسان') diff = 'easy';
                        else if (item.difficulty_level === 'سخت') diff = 'hard';

                        return {
                            id: item.id,
                            text: item.question_text || '',
                            image: item.images && item.images.length > 0 ? item.images[0] : undefined,
                            // استخراج متن گزینه‌ها از آبجکت‌های دریافتی
                            options: item.options ? item.options.map((opt: any) => opt.text) : [],
                            // اگر ایندکس جواب درست در دیتا نیست، پیش‌فرض 0 در نظر می‌گیریم
                            correctAnswerIndex: item.correct_answer_index ?? 0,
                            descriptiveAnswer: item.descriptive_answer || 'پاسخ تشریحی ناموجود',
                            difficulty: diff,
                            // تبدیل تایم‌استمپ به تاریخ شمسی یا هر فرمت دلخواه
                            date: item.favorited_at ? new Date(item.favorited_at).toLocaleDateString('fa-IR') : 'نامشخص',
                            timestamp: item.timestamp || item.favorited_at || Date.now(),

                            lesson: item.lesson,
                            subject: item.subject,
                            chapter: item.chapter,
                            grade: item.grade

                        };
                    });

                    setFavorites(formattedData);
                } else if (isMounted) {
                    setError(response.message || 'خطا در دریافت اطلاعات');
                }
            } catch (err) {
                if (isMounted) setError('خطا در ارتباط با سرور');
                console.error(err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchFavorites();

        return () => { isMounted = false; };
    }, []);


    // Filter & Sort Logic
    const processedFavorites = useMemo(() => {
        let result = favorites.filter(q =>
            q.text?.includes(searchQuery) ||
            q.lesson?.includes(searchQuery) ||
            q.subject?.includes(searchQuery)
        );

        return result.sort((a, b) => {
            if (sortBy === 'newest') return b.timestamp - a.timestamp;
            if (sortBy === 'oldest') return a.timestamp - b.timestamp;
            if (sortBy === 'lesson') return (a.lesson || '').localeCompare(b.lesson || '', 'fa');
            return 0;
        });
    }, [favorites, searchQuery, sortBy]);

    // MathJax Updater Effect
    useEffect(() => {
        const triggerMathJax = () => {
            if (typeof window !== 'undefined' && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
                (window as any).MathJax.typesetPromise().catch((err: any) => console.error('MathJax err:', err));
            }
        };

        const timeout = setTimeout(triggerMathJax, 100);
        return () => clearTimeout(timeout);
    }, [processedFavorites, selectedQuestion, isLoading]);

    const handleRemove = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();

        // Optimistic update
        const previousFavorites = [...favorites];
        setFavorites(prev => prev.filter(item => item.id !== id));

        try {
            const response = await flowApi.dispatch('remove_favorite', { question_id: id });
            if (response.success) {
                toast('با موفقیت حذف شد');
            }
            else {
                setFavorites(previousFavorites);
                toast('با موفقیت حذف شد');
            }
        } catch (err) {
            // Revert if error
            setFavorites(previousFavorites);
            toast('مشکل در حذف از علاقه مندی ها');

            console.error('Failed to remove favorite:', err);
        }
    };

    const handleCopy = async (question: Question) => {
        const difficultyStr = getDifficultyConfig(question.difficulty).label;
        const optionsStr = (question.options || []).map((opt, i) => `${i + 1}️⃣ ${opt}`).join('\n');
        const copyText = `📚 درس: ${question.lesson}\n❓ سوال:\n${question.text}\nگزینه‌ها:\n${optionsStr}\n✅ پاسخ صحیح: گزینه ${(question.correctAnswerIndex || 0) + 1}\n📝 پاسخ تشریحی:\n${question.descriptiveAnswer}`;
        try {
            await navigator.clipboard.writeText(copyText);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">

                    {/* Header Section */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

                        {/* 1. Mobile Title & Back Row */}
                        <div className="flex lg:hidden items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                    <Heart size={22} className="fill-current" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-[var(--text-primary)]">علاقه‌مندی‌ها</h1>
                                </div>
                            </div>
                            <button
                                onClick={onBack}
                                className="w-10 p-0 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors"
                            >
                                <ChevronLeft size={20} strokeWidth={2} />
                            </button>
                        </div>

                        {/* 2. Filters & Search */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto"
                        >
                            {/* Tab Pill Animated Segmentation */}
                            <div className="flex items-center w-full lg:w-auto p-1.5 bg-[var(--bg-element)]/60 border border-[var(--border)]/50 rounded-2xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {(['newest', 'oldest', 'lesson'] as SortOption[]).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setSortBy(type)}
                                        className="relative px-6 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-colors duration-300 flex-1 lg:flex-none text-center"
                                    >
                                        {sortBy === type && (
                                            <motion.div
                                                layoutId="activeTabIndicator"
                                                className="absolute inset-0 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className={`relative z-10 ${sortBy === type ? 'text-[var(--color-primary-600)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                                            {type === 'newest' ? 'جدیدترین' : type === 'oldest' ? 'قدیمی‌ترین' : 'بر اساس درس'}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Search Bar Minimal */}
                            <div className="relative w-full lg:w-96">
                                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="جستجو در سوال، درس یا مبحث..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-12 bg-[var(--bg-element)]/30 border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-2xl pr-11 pl-4 focus:outline-none focus:bg-[var(--bg-card)] focus:border-[var(--color-primary-500)] focus:ring-4 focus:ring-[var(--color-primary-500)]/10 transition-all duration-300 placeholder:text-[var(--text-muted)]"
                                />
                            </div>
                        </motion.div>

                        {/* 3. Desktop Back Button */}
                        <motion.button
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            onClick={onBack}
                            className="hidden lg:flex group items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300"
                        >
                            <span className="text-sm font-bold">بازگشت</span>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] group-hover:bg-[var(--color-primary-500)] group-hover:text-white transition-colors duration-300 border border-[var(--border)] group-hover:border-transparent">
                                <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform duration-300" />
                            </div>
                        </motion.button>
                    </div>

                    {/* Content Section (Loading / Empty / List) */}
                    {isLoading ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <Loader2 size={32} className="text-[var(--color-primary-500)] animate-spin mb-4" />
                            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">در حال دریافت علاقه‌مندی‌ها...</h3>
                        </motion.div>
                    ) : error ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <h3 className="text-base font-bold text-rose-500 mb-2">{error}</h3>
                            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-[var(--bg-element)] text-[var(--text-primary)] rounded-xl border border-[var(--border)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors">تلاش مجدد</button>
                        </motion.div>
                    ) : processedFavorites.length > 0 ? (
                        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <AnimatePresence>
                                {processedFavorites.map((q) => {
                                    const diff = getDifficultyConfig(q.difficulty);
                                    return (
                                        <motion.div
                                            key={q.id}
                                            layout
                                            variants={itemVariants}
                                            initial="hidden" animate="visible" exit="exit"
                                            className="group relative flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--color-primary-500)]/40 hover:shadow-md transition-shadow duration-300"
                                        >
                                            {/* Card Top: Badges */}
                                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${diff.bg} ${diff.color} ${diff.border}`}>
                                                    {diff.label}
                                                </span>
                                                <span className="text-[10px] font-semibold bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                                    <BookOpen size={12} /> {q.lesson}
                                                </span>
                                                <span className="text-[10px] font-semibold bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded-md hidden sm:flex items-center gap-1.5">
                                                    <Layers size={12} /> {q.chapter}
                                                </span>
                                            </div>

                                            {/* Question Snippet */}
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-[var(--text-primary)] leading-relaxed line-clamp-3 mb-6">
                                                    {q.text}
                                                </p>
                                            </div>

                                            {/* Card Bottom: Meta & Actions */}
                                            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]/60 mt-auto">
                                                <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]">
                                                    <Calendar size={14} />
                                                    <span>{q.date}</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={(e) => handleRemove(q.id, e)}
                                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-rose-500 text-[var(--color-primary-600)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors duration-300 border border-transparent hover:border-[var(--color-primary-600)]/20 font-bold text-xs"
                                                    >
                                                        <Trash2 size={16} strokeWidth={2} />
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setSelectedQuestion(q)}
                                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-500)]/10 text-[var(--color-primary-600)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors duration-300 border border-transparent hover:border-[var(--color-primary-600)]/20 font-bold text-xs"
                                                    >
                                                        <Eye size={16} />
                                                        <span>مشاهده سوال</span>
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        /* Empty State */
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-element)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                                <Heart size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">لیست علاقه‌مندی‌ها خالی است</h3>
                            <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                                جستجوی شما نتیجه‌ای نداشت یا هنوز سوالی را به علاقه‌مندی‌ها اضافه نکرده‌اید.
                            </p>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* --- Observe Modal --- */}
            <ResponsiveModal
                isOpen={!!selectedQuestion}
                onClose={() => { setSelectedQuestion(null); setIsCopied(false); }}
                title={<span className="flex items-center gap-2"><Heart size={18} className="text-rose-500 fill-rose-500/20" /> جزئیات سوال</span>}
            >
                {selectedQuestion && (
                    <div className="flex flex-col gap-6 pb-4 w-full lg:w-[800px] max-w-full">

                        {/* Meta Tags Row */}
                        <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-element)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)]">
                                <BookOpen size={14} className="text-[var(--color-primary-500)]" /> {selectedQuestion.lesson}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-element)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)]">
                                <GraduationCap size={14} className="text-[var(--color-primary-500)]" /> {selectedQuestion.grade}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-element)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)]">
                                <Layers size={14} className="text-[var(--color-primary-500)]" /> {selectedQuestion.chapter} - {selectedQuestion.subject}
                            </div>
                        </div>

                        {/* Question Box */}
                        <div className="space-y-4">
                            <h3 className="text-sm md:text-base font-extrabold text-[var(--text-primary)] leading-loose">
                                {selectedQuestion.text}
                            </h3>

                            {/* Question Image */}
                            {selectedQuestion.image && (
                                <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-element)]">
                                    <img src={selectedQuestion.image} alt="تصویر سوال" className="w-full object-cover" />
                                </div>
                            )}
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(selectedQuestion.options || []).map((opt, idx) => {
                                const isCorrect = idx === selectedQuestion.correctAnswerIndex;
                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-3 p-3.5 rounded-xl border ${
                                            isCorrect
                                                ? 'bg-[#22c55e]/5 border-[#22c55e]/30 text-[var(--text-primary)]'
                                                : 'bg-[var(--bg-element)] border-[var(--border)] text-[var(--text-secondary)]'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                            isCorrect ? 'bg-[#22c55e] text-white shadow-sm' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <span className={`text-sm font-semibold ${isCorrect ? 'text-[#22c55e]' : ''}`}>{opt}</span>
                                        {isCorrect && <CheckCheck size={18} className="text-[#22c55e] mr-auto shrink-0" />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Descriptive Answer */}
                        <div className="bg-[var(--color-primary-500)]/5 border border-[var(--color-primary-500)]/20 rounded-xl p-5 mt-2 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1 h-full bg-[var(--color-primary-500)]"></div>
                            <h4 className="text-xs font-bold text-[var(--color-primary-600)] mb-3 flex items-center gap-1.5">
                                <Clock size={16} /> پاسخ تشریحی:
                            </h4>
                            <p className="text-sm font-medium text-[var(--text-primary)] leading-loose text-justify">
                                {selectedQuestion.descriptiveAnswer}
                            </p>
                        </div>

                        {/* Footer Action: Copy */}
                        <div className="pt-4 mt-2 border-t border-[var(--border)] flex justify-end">
                            <button
                                onClick={() => handleCopy(selectedQuestion)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 border ${
                                    isCopied
                                        ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
                                        : 'bg-[var(--bg-element)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-card)]'
                                }`}
                            >
                                {isCopied ? <CheckCheck size={16} /> : <Copy size={16} />}
                                <span>{isCopied ? 'کپی شد!' : 'کپی سوال و پاسخ'}</span>
                            </button>
                        </div>

                    </div>
                )}
            </ResponsiveModal>

        </div>
    );
}
