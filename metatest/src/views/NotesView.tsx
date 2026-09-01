import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, ChevronLeft, BookOpen, Clock,
    BarChart, FileText, Eye, CheckCircle2, Circle,
    Loader2, AlertTriangle, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { flowApi } from '../lib/authApi';
import { toast } from 'sonner';
import { ResponsiveModal } from '../components/ResponsiveModal'; // مسیر ایمپورت خود را چک کنید

// آدرس پایه برای لود تصاویر (تغییر دهید به آدرس واقعی سرور خود)
const IMAGE_BASE_URL = 'https://metatest.app/uploads/questions/';

interface NoteItem {
    id: number;
    questionId: number;
    questionText: string;
    options: string[];
    correctAnswerIndex: number;
    descriptiveAnswer?: string;
    images?: string[];
    subject: string;
    topic: string;
    difficulty: 'آسان' | 'متوسط' | 'سخت';
    date: string;
    noteText: string;
    timestamp: number;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
};

interface NotesViewProps {
    onBack: () => void;
}

export function NotesView({ onBack }: NotesViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);

    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchNotes = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await flowApi.dispatch('get_notes');
                if (response.success) {
                    setNotes(response.data);
                } else {
                    const msg = response.message || 'خطا در دریافت یادداشت‌ها';
                    setError(msg);
                    toast.error(msg);
                }
            } catch (err: any) {
                const msg = err.message || 'خطای شبکه در ارتباط با سرور';
                setError(msg);
                toast.error(msg);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotes();
    }, []);

    const processedNotes = useMemo(() => {
        return notes.filter(note =>
            (note.questionText && note.questionText.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (note.noteText && note.noteText.toLowerCase().includes(searchQuery.toLowerCase()))
        ).sort((a, b) => b.timestamp - a.timestamp);
    }, [notes, searchQuery]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (typeof window !== 'undefined' && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
                (window as any).MathJax.typesetPromise().catch((err: any) => console.error('MathJax error:', err));
            }
        }, 150);
        return () => clearTimeout(timeout);
    }, [processedNotes, selectedNote]);

    // تابع حذف یادداشت
    const handleDeleteNote = async (noteId: number) => {
        if (!window.confirm('آیا از حذف این یادداشت اطمینان دارید؟')) return;

        setIsDeleting(true);
        try {
            const response = await flowApi.dispatch('delete_note', { note_id: noteId });
            if (response.success) {
                toast.success('یادداشت با موفقیت حذف شد.');
                setNotes(prev => prev.filter(n => n.id !== noteId));
                if (selectedNote?.id === noteId) {
                    setSelectedNote(null);
                }
            } else {
                toast.error(response.message || 'خطا در حذف یادداشت');
            }
        } catch (err: any) {
            toast.error(err.message || 'خطای شبکه در ارتباط با سرور');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">

                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex lg:hidden items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                    <FileText size={22} className="fill-blue-500/20" />
                                </div>
                                <h1 className="text-xl font-black text-[var(--text-primary)]">یادداشت‌ها</h1>
                            </div>
                            <button
                                onClick={onBack}
                                className="w-10 h-10 p-0 rounded-full flex items-center justify-center bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors">
                                <ChevronLeft size={26} strokeWidth={2.5} />
                            </button>
                        </div>

                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
                            <div className="relative w-full lg:w-96">
                                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                <input
                                    type="text" placeholder="جستجو در سوالات و یادداشت‌ها..." value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-12 bg-[var(--bg-element)]/30 border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-2xl pr-11 pl-4 focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-4 focus:ring-[var(--color-primary-500)]/10 transition-all placeholder:text-[var(--text-muted)]"
                                />
                            </div>
                        </motion.div>

                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onBack}
                                       className="hidden lg:flex group items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                            <span className="text-sm font-bold">بازگشت</span>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] group-hover:bg-[var(--color-primary-500)] group-hover:text-white border border-[var(--border)] group-hover:border-transparent transition-all">
                                <ChevronLeft size={26} strokeWidth={2.5} />
                            </div>
                        </motion.button>
                    </div>

                    {/* Content List */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Loader2 size={32} className="animate-spin text-[var(--color-primary-500)] mb-4" />
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">در حال دریافت یادداشت‌ها...</h3>
                        </div>
                    ) : error ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-rose-50/50 dark:bg-rose-500/5 rounded-3xl border border-rose-200 dark:border-rose-500/20 border-dashed">
                            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mb-5">
                                <AlertTriangle size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2">مشکلی پیش آمد</h3>
                            <p className="text-xs text-rose-500 dark:text-rose-300 max-w-xs">{error}</p>
                        </motion.div>
                    ) : processedNotes.length > 0 ? (
                        <motion.div
                            variants={containerVariants} initial="hidden" animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5"
                        >
                            {processedNotes.map((note) => (
                                <motion.div
                                    key={note.id} variants={cardVariants}
                                    className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-5 flex flex-col hover:border-[var(--color-primary-500)]/40 transition-colors shadow-sm group"
                                >
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-3 py-1 rounded-full bg-[var(--bg-element)] text-[var(--text-secondary)] text-xs font-semibold">
                                                {note.subject || 'نامشخص'}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[var(--text-muted)] text-xs">{note.date}</span>
                                                <button
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    disabled={isDeleting}
                                                    className="text-rose-400 hover:text-rose-600 transition-colors bg-rose-50 dark:bg-rose-500/10 p-1.5 rounded-lg"
                                                    title="حذف یادداشت"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="min-h-[3rem]">
                                            <div
                                                className="text-sm font-bold text-[var(--text-primary)] leading-loose line-clamp-3"
                                                dangerouslySetInnerHTML={{ __html: note.questionText || 'متن سوال' }}
                                            />
                                        </div>

                                        <div className="bg-blue-500/5 dark:bg-blue-500/10 border-r-2 border-blue-500 p-3 rounded-l-lg mt-2">
                                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                                                <span className="font-bold text-blue-600 dark:text-blue-400 ml-1">یادداشت:</span>
                                                {note.noteText}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedNote(note)}
                                        className="mt-6 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 bg-[var(--bg-element)]/50 text-[var(--color-primary-600)] font-bold text-sm border border-[var(--border)] group-hover:bg-[var(--color-primary-500)] group-hover:text-white group-hover:border-transparent transition-all"
                                    >
                                        <Eye size={18} />
                                        مشاهده جزئیات سوال
                                    </button>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-element)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                                <FileText size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">یادداشتی یافت نشد</h3>
                            <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                                {searchQuery ? 'با کلمات جستجو شده، یادداشتی پیدا نکردیم.' : 'شما هنوز هیچ یادداشتی ثبت نکرده‌اید.'}
                            </p>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* Modal Detail باستخدام ResponsiveModal */}
            {selectedNote && (
                <ResponsiveModal
                    isOpen={!!selectedNote}
                    onClose={() => setSelectedNote(null)}
                    title={
                        <div className="flex items-center gap-2">
                            <FileText size={20} className="text-blue-500" />
                            <span className="text-base">جزئیات سوال و یادداشت</span>
                        </div>
                    }
                >
                    <div className="space-y-6 pb-6">
                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-element)] text-[var(--text-secondary)] text-xs font-medium border border-[var(--border)]/50">
                                <BookOpen size={14} /> <span>{selectedNote.subject || 'نامشخص'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-element)] text-[var(--text-secondary)] text-xs font-medium border border-[var(--border)]/50">
                                <Clock size={14} /> <span>{selectedNote.topic || 'نامشخص'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-element)] text-[var(--text-secondary)] text-xs font-medium border border-[var(--border)]/50">
                                <BarChart size={14} /> <span>{selectedNote.difficulty || 'نامشخص'}</span>
                            </div>
                        </div>

                        {/* User Note */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-5 shadow-sm relative">
                            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                                <FileText size={16} />
                                یادداشت شما
                            </h4>
                            <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                                {selectedNote.noteText}
                            </p>
                            {/* دکمه حذف داخل مودال */}
                            <button
                                onClick={() => handleDeleteNote(selectedNote.id)}
                                disabled={isDeleting}
                                className="absolute left-4 top-4 text-rose-500 hover:text-rose-700 bg-white dark:bg-rose-500/20 p-2 rounded-lg transition-colors border border-rose-100 dark:border-rose-500/30 shadow-sm"
                                title="حذف این یادداشت"
                            >
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                        </div>

                        {/* Question Text */}
                        <div className="bg-[var(--bg-element)]/30 rounded-2xl p-5 border border-[var(--border)]/50">
                            <div
                                className="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-loose"
                                dangerouslySetInnerHTML={{ __html: selectedNote.questionText }}
                            />
                        </div>

                        {/* Images (If any) */}
                        {selectedNote.images && selectedNote.images.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">تصاویر سوال</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    {selectedNote.images.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={`${IMAGE_BASE_URL}${img}`}
                                            alt={`تصویر ${idx + 1}`}
                                            className="w-full max-w-lg mx-auto rounded-2xl border border-[var(--border)] object-contain bg-white"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Options */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">گزینه ها</h4>
                            {selectedNote.options && selectedNote.options.map((option, idx) => {
                                const isCorrect = selectedNote.correctAnswerIndex === idx;
                                return (
                                    <div
                                        key={`option-${idx}`}
                                        className={`w-full p-4 rounded-2xl border text-right transition-all duration-300 flex items-center justify-between ${
                                            isCorrect
                                                ? 'border-emerald-500 bg-emerald-500/5 text-[var(--text-primary)] shadow-sm'
                                                : 'border-[var(--border)] bg-[var(--bg-element)]/20 text-[var(--text-secondary)] opacity-80'
                                        }`}
                                    >
                                        <span
                                            className="text-sm sm:text-base font-medium leading-relaxed ml-4"
                                            dangerouslySetInnerHTML={{ __html: option }}
                                        />
                                        <div className="shrink-0 flex items-center gap-3">
                                            {isCorrect && (
                                                <span className="hidden sm:inline-block text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-md">پاسخ صحیح</span>
                                            )}
                                            {isCorrect ? (
                                                <CheckCircle2 size={24} className="text-emerald-500" />
                                            ) : (
                                                <Circle size={24} className="text-[var(--text-muted)]/50" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Descriptive Answer */}
                        {selectedNote.descriptiveAnswer && (
                            <div className="mt-6 border-t border-[var(--border)] pt-6">
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl p-5 shadow-sm">
                                    <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
                                        <CheckCircle2 size={18} />
                                        پاسخ تشریحی
                                    </h4>
                                    <div
                                        className="text-sm sm:text-base text-[var(--text-primary)] leading-loose"
                                        dangerouslySetInnerHTML={{ __html: selectedNote.descriptiveAnswer }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </ResponsiveModal>
            )}
        </div>
    );
}
