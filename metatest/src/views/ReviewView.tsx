import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, ClipboardList, BookOpen, Calendar, Clock, CheckCheck,
    ChevronLeft, CheckCircle, XCircle, FileEdit, Timer, Info, Loader2, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { flowApi } from '../lib/authApi';
import { toast } from 'sonner';
import { ResponsiveModal } from '../components/ResponsiveModal';
import { MathRenderer } from '../components/ui/MathRenderer';

const IMAGE_BASE_URL = 'images/questions/';

type Difficulty = 'easy' | 'medium' | 'hard';
type SortOption = 'newest' | 'oldest' | 'lesson';

interface Question {
    id: number;
    text: string;
    image?: string;
    options: string[];
    correctAnswerIndex: number;
    userAnswerIndex: number | null;
    descriptiveAnswer?: string;
    difficulty: Difficulty;
    date: string;
    timestamp: number;
    lesson: string;
    subject: string;
    chapter: string;
    grade: string;
}

const getDifficultyConfig = (diff: Difficulty) => {
    switch (diff) {
        case 'easy': return { label: 'آسان', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/20' };
        case 'medium': return { label: 'متوسط', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/20' };
        case 'hard': return { label: 'سخت', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20' };
        default: return { label: 'نامشخص', color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' };
    }
};

interface ReviewViewProps {
    onBack: () => void;
}

export function ReviewView({ onBack }: ReviewViewProps) {
    const [reviews, setReviews] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>('newest');

    // State for Modal
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [timeLeft, setTimeLeft] = useState(10);

    // State for Note
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [noteText, setNoteText] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        flowApi.dispatch('get_review_later_questions')
            .then((response: any) => {
                if (response.success && response.data) {
                    setReviews(response.data);
                } else {
                    toast.error(response.message || 'خطا در دریافت لیست مرور');
                }
            })
            .catch(() => toast.error('خطای ارتباط با سرور'))
            .finally(() => setIsLoading(false));
    }, []);

    const processedReviews = useMemo(() => {
        let result = reviews.filter(q =>
            (q.text && q.text.includes(searchQuery)) ||
            (q.lesson && q.lesson.includes(searchQuery)) ||
            (q.subject && q.subject.includes(searchQuery))
        );

        return result.sort((a, b) => {
            if (sortBy === 'newest') return b.timestamp - a.timestamp;
            if (sortBy === 'oldest') return a.timestamp - b.timestamp;
            if (sortBy === 'lesson') return a.lesson.localeCompare(b.lesson, 'fa');
            return 0;
        });
    }, [reviews, searchQuery, sortBy]);



    // Timer Logic
    useEffect(() => {
        if (!selectedQuestion || timeLeft <= 0) return;
        const timerId = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timerId);
    }, [selectedQuestion, timeLeft]);

    const openQuestionModal = (q: Question) => {
        setSelectedQuestion(q);
        setTimeLeft(10); // Reset timer to 10 seconds
        setIsNoteOpen(false);
        setNoteText("");
    };

    const handleCloseModal = () => {
        setSelectedQuestion(null);
    };

    const handleMarkAsRead = async () => {
        if (!selectedQuestion) return;
        const questionId = selectedQuestion.id;

        // 1. بستن مودال بدون اینکه کاربر متوجه پروسه حذف شود
        handleCloseModal();

        // 2. حذف از UI
        setTimeout(() => {
            setReviews(prev => prev.filter(q => q.id !== questionId));
        }, 300);

        // 3. ارسال درخواست حذف به بک‌اند در پس‌زمینه
        try {
            await flowApi.dispatch('remove_from_review_later', { question_id: questionId });
        } catch (err) {
            console.error("Error removing from review list", err);
        }
    };

    const handleSaveNote = async () => {
        if (!noteText.trim() || !selectedQuestion) return;
        setIsSavingNote(true);
        try {
            // نام اکشن بک‌اند خود برای افزودن یادداشت را جایگزین کنید (مثلا add_note_tam24)
            await flowApi.dispatch('add_note', { question_id: selectedQuestion.id, text: noteText });
            toast.success('یادداشت با موفقیت ذخیره شد');
            setIsNoteOpen(false);
            setNoteText("");
        } catch (error) {
            toast.error('خطا در ذخیره یادداشت');
        } finally {
            setIsSavingNote(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)] relative">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">

                    {/* Header Section */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex lg:hidden items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-[var(--color-primary-500)]/10 text-[var(--color-primary-600)] flex items-center justify-center shrink-0">
                                    <ClipboardList size={22} className="stroke-current" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-[var(--text-primary)]">باکس مرور</h1>
                                </div>
                            </div>
                            <button
                                onClick={onBack}
                                className="w-10 p-0 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors"
                            >
                                <ChevronLeft size={26} strokeWidth={2.5} className="mr-0.5" />
                            </button>
                        </div>

                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
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

                        <motion.button
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            onClick={onBack}
                            className="hidden lg:flex group items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300"
                        >
                            <span className="text-sm font-bold">بازگشت</span>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] group-hover:bg-[var(--color-primary-500)] group-hover:text-white transition-colors duration-300 border border-[var(--border)] group-hover:border-transparent">
                                <ChevronLeft size={26} strokeWidth={2.5} className="mr-0.5 group-hover:-translate-x-0.5 transition-transform duration-300" />
                            </div>
                        </motion.button>
                    </div>

                    {/* How It Works - Info Box */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 sm:p-5 flex gap-4 items-start"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                            <Info size={22} />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-blue-700 dark:text-blue-400 mb-1.5">سیستم مرور هوشمند</h3>
                            <p className="text-xs sm:text-sm text-blue-600/80 dark:text-blue-300/80 leading-relaxed text-justify">
                                سوالاتی که در آزمون‌ها به آن‌ها پاسخ اشتباه داده‌اید به صورت خودکار به این بخش منتقل می‌شوند تا مسیر یادگیری شما کامل شود. برای مرور، هر سوال را باز کرده و پاسخ تشریحی آن را مطالعه کنید. جهت اطمینان از یادگیری، دکمه تایید پس از ۱۰ ثانیه فعال می‌شود.
                            </p>
                        </div>
                    </motion.div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-500)] mb-4" />
                            <p className="text-sm font-bold text-[var(--text-primary)]">در حال دریافت سوالات...</p>
                        </div>
                    ) : processedReviews.length > 0 ? (
                        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AnimatePresence mode="popLayout">
                                {processedReviews.map((q) => {
                                    const diff = getDifficultyConfig(q.difficulty);

                                    return (
                                        <motion.div
                                            key={q.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            onClick={() => openQuestionModal(q)}
                                            className="group cursor-pointer bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 hover:border-[var(--color-primary-500)]/40 hover:shadow-md transition-all duration-300 flex flex-col gap-4"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${diff.bg} ${diff.color} ${diff.border}`}>
                                                        {diff.label}
                                                    </span>
                                                    <span className="text-[10px] font-semibold bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                                        <BookOpen size={12} /> {q.lesson}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                                    <Calendar size={12} /> {q.date}
                                                </span>
                                            </div>

                                            <MathRenderer text={q.text} className="text-sm font-bold text-[var(--text-primary)] leading-loose line-clamp-2" />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <div className="w-16 h-16 rounded-full bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-5">
                                <CheckCircle size={32} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">لیست مرور شما خالی است!</h3>
                            <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                                تبریک! شما در حال حاضر هیچ سوالی برای مرور ندارید.
                            </p>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* Modal for Question Details */}
            <ResponsiveModal
                isOpen={!!selectedQuestion}
                onClose={handleCloseModal}
                title="مرور سوال"
            >
                {selectedQuestion && (
                    <div className="flex flex-col gap-6 pb-6">

                        {/* Note Toggle Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setIsNoteOpen(!isNoteOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                    isNoteOpen
                                        ? 'bg-[var(--color-primary-500)] text-white'
                                        : 'bg-[var(--bg-element)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                                }`}
                            >
                                <FileEdit size={14} />
                                {isNoteOpen ? 'بستن یادداشت' : 'افزودن یادداشت'}
                            </button>
                        </div>

                        {/* Note Input Area */}
                        <AnimatePresence>
                            {isNoteOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-[var(--bg-element)]/50 border border-[var(--border)] rounded-xl p-3 flex flex-col gap-3">
                                        <textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="نکات مهم این سوال را برای خودت بنویس..."
                                            className="w-full h-24 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-[var(--color-primary-500)]"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleSaveNote}
                                                disabled={!noteText.trim() || isSavingNote}
                                                className="flex items-center gap-2 bg-[var(--color-primary-500)] text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                                            >
                                                {isSavingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                ثبت یادداشت
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Question Data */}
                        <div className="space-y-6">
                            <div className="text-sm font-bold text-[var(--text-primary)] leading-loose">
                                <MathRenderer text={selectedQuestion.text}  />
                            </div>
                            {selectedQuestion.image && (
                                <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white p-2">
                                    <img src={`${IMAGE_BASE_URL}${selectedQuestion.image}`} alt="تصویر سوال" className="w-full object-contain max-h-64" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3">
                                {selectedQuestion.options.map((opt, idx) => {
                                    const isCorrect = idx === selectedQuestion.correctAnswerIndex;

                                    // اینجا برای حالت مرور، گزینه صحیح را برجسته میکنیم
                                    let optionClass = 'bg-[var(--bg-element)] border-[var(--border)] text-[var(--text-secondary)]';
                                    let indicatorClass = 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]';

                                    if (isCorrect) {
                                        optionClass = 'bg-[#22c55e]/10 border-[#22c55e]/40 text-[#22c55e] shadow-sm';
                                        indicatorClass = 'bg-[#22c55e] text-white';
                                    }

                                    return (
                                        <div key={idx} className={`flex items-center gap-3 p-3.5 rounded-xl border ${optionClass}`}>
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${indicatorClass}`}>
                                                {idx + 1}
                                            </div>

                                            <div className="text-sm font-semibold flex-1 leading-loose">
                                                <MathRenderer text={opt}  />
                                            </div>
                                            {isCorrect && <CheckCheck size={18} className="text-[#22c55e] shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedQuestion.descriptiveAnswer && (
                                <div className="bg-[var(--color-primary-500)]/5 border border-[var(--color-primary-500)]/20 rounded-xl p-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-[var(--color-primary-500)]"></div>
                                    <h4 className="text-xs font-bold text-[var(--color-primary-600)] mb-3 flex items-center gap-1.5">
                                        <Clock size={16} /> پاسخ تشریحی:
                                    </h4>
                                    <div
                                        className="text-sm font-medium text-[var(--text-primary)] leading-loose text-justify">
                                    <MathRenderer text={selectedQuestion.descriptiveAnswer}  />

                                </div>
                                </div>
                            )}
                        </div>

                        {/* Timer Button */}
                        <div className="mt-4 pt-4 border-t border-[var(--border)] relative">
                            <button
                                disabled={timeLeft > 0}
                                onClick={handleMarkAsRead}
                                className={`relative overflow-hidden w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center transition-colors shadow-sm
                                    ${timeLeft > 0 ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-[#22c55e] hover:bg-[#16a34a]'}`}
                            >
                                {/* Progress Background for timer */}
                                {timeLeft > 0 && (
                                    <motion.div
                                        initial={{ width: "0%" }}
                                        animate={{ width: "100%" }}
                                        transition={{ duration: 10, ease: "linear" }}
                                        className="absolute top-0 right-0 h-full bg-[var(--color-primary-500)]/20 origin-right"
                                    />
                                )}

                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {timeLeft > 0 ? (
                                        <>
                                            <Timer size={18} className="animate-pulse" />
                                            <span>{timeLeft} ثانیه تا تایید مطالعه</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCheck size={18} />
                                            <span>مطالعه کردم و یاد گرفتم</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>

                    </div>
                )}
            </ResponsiveModal>
        </div>
    );
}
