import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, FileText, Download, Inbox, AlertTriangle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PdfItem {
    id: number;
    title: string;
    description: string;
    category: 'pamphlet' | 'exam' | 'guide'; // جزوه، نمونه سوال، درسنامه
    categoryLabel: string;
    subject: string;
    grade: string;
    fileSize: string;
    pages: number;
    downloadUrl: string;
    uploadedAt: string;
    downloadCount: number;
}

const CATEGORY_OPTIONS = [
    { label: 'همه فایل‌ها', value: 'all' },
    { label: 'جزوات', value: 'pamphlet' },
    { label: 'نمونه سوالات', value: 'exam' },
    { label: 'درسنامه‌ها', value: 'guide' },
];

// One light, fast fade for the whole grid when the filter/search changes.
const fadeTransition = { duration: 0.18, ease: 'easeOut' as const };

// ─── Loading skeleton card ────────────────────────────────────────────────────
const PdfCardSkeleton = () => (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-element)]" />
            <div className="w-16 h-5 rounded-full bg-[var(--bg-element)]" />
        </div>
        <div className="h-3 w-2/3 rounded bg-[var(--bg-element)]" />
        <div className="h-3 w-full rounded bg-[var(--bg-element)]" />
        <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-[var(--bg-element)]" />)}
        </div>
        <div className="h-9 rounded-xl bg-[var(--bg-element)]" />
    </div>
);

interface PdfLibraryViewProps {
    onBack?: () => void;
    onStateChange?: (state: { title: string; showBackButton: boolean }) => void;
}

export const PdfLibraryView = ({ onStateChange }: PdfLibraryViewProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    // --- API States ---
    const [pdfs, setPdfs] = useState<PdfItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        onStateChange?.({ title: 'نمونه سوالات', showBackButton: true });
    }, [onStateChange]);

    // --- Fetch library from the backend (pdf_library table, active files only) ---
    useEffect(() => {
        let cancelled = false;

        const fetchPdfs = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await flowApi.dispatch('get_pdfs');
                if (cancelled) return;

                if (res.success && Array.isArray(res.pdfs)) {
                    const mapped: PdfItem[] = res.pdfs.map((p: any) => ({
                        id: p.id,
                        title: p.title || '',
                        description: p.description || '',
                        category: p.category,
                        categoryLabel: p.category_label || (p.category === 'pamphlet' ? 'جزوه' : p.category === 'exam' ? 'نمونه سوال' : 'درسنامه'),
                        subject: p.subject || '',
                        grade: p.grade || '',
                        fileSize: p.file_size || '',
                        pages: Number(p.pages) || 0,
                        downloadUrl: p.download_url || '',
                        uploadedAt: p.uploaded_at ? new Date(p.uploaded_at).toLocaleDateString('fa-IR') : '',
                        downloadCount: Number(p.download_count) || 0,
                    }));
                    setPdfs(mapped);
                } else {
                    setError(res.message || 'خطا در دریافت فایل‌های کتابخانه');
                }
            } catch (err: any) {
                if (!cancelled) setError(err?.message || 'خطای شبکه در ارتباط با سرور');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchPdfs();
        return () => { cancelled = true; };
    }, [reloadKey]);

    // Filter Logic (client-side over the fetched list)
    const filteredPdfs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return pdfs.filter((pdf) => {
            const matchesCategory = activeCategory === 'all' || pdf.category === activeCategory;
            const matchesSearch =
                !query ||
                pdf.title.toLowerCase().includes(query) ||
                pdf.description.toLowerCase().includes(query) ||
                pdf.subject.toLowerCase().includes(query) ||
                pdf.grade.toLowerCase().includes(query);

            return matchesCategory && matchesSearch;
        });
    }, [pdfs, searchQuery, activeCategory]);

    const handleDownload = async (pdf: PdfItem) => {
        if (!pdf.downloadUrl) {
            toast.error('لینک دانلود این فایل در دسترس نیست.');
            return;
        }

        // Count the download in the backend (non-blocking for the user)
        flowApi.dispatch('track_pdf_download', { pdf_id: pdf.id }).catch(() => {});

        // Trigger the real file download
        const link = document.createElement('a');
        link.href = pdf.downloadUrl;
        link.download = `${pdf.title}.pdf`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`دانلود «${pdf.title}» آغاز شد.`);
        setPdfs(prev => prev.map(p => p.id === pdf.id ? { ...p, downloadCount: p.downloadCount + 1 } : p));
    };

    return (
        <div className="w-full h-full bg-background overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-16 pt-6">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

                {/* ─── Filter & Search Bar ────────────────────────────────────── */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                        {/* Search Input */}
                        <div className="relative md:col-span-5">
                            <input
                                type="text"
                                placeholder="جستجوی نام جزوه، درس یا پایه تحصیلی..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[var(--bg-element)] border border-[var(--border)]/70 rounded-[12px] pl-3 pr-10 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[11px] text-right"
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 right-3.5 text-[var(--text-muted)] pointer-events-none">
                                <Search size={16} />
                            </div>
                        </div>

                        {/* Sliding Category Pills */}
                        <div className="md:col-span-7 flex bg-[var(--bg-element)]/80 p-1 rounded-[12px] border border-[var(--border)]/50 w-full overflow-x-auto [&::-webkit-scrollbar]:hidden">
                            {CATEGORY_OPTIONS.map((opt) => {
                                const isActive = activeCategory === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setActiveCategory(opt.value)}
                                        className={`relative flex-1 min-w-[90px] px-3 py-2 text-[11px] font-semibold rounded-[10px] transition-all duration-300 whitespace-nowrap ${
                                            isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50'
                                        }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-pdf-tab"
                                                className="absolute inset-0 bg-[var(--accent)] rounded-[10px] shadow-sm shadow-[var(--accent)]/20"
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className="relative z-10">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                    </div>
                </div>

                {/* ─── Loading / Error / PDF Cards Grid ───────────────────────── */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => <PdfCardSkeleton key={`pdf-skel-${i}`} />)}
                    </div>
                ) : error ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3 bg-rose-50/50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 border-dashed rounded-2xl text-center">
                        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <AlertTriangle size={22} />
                        </div>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">مشکلی پیش آمد</span>
                        <span className="text-[11px] text-rose-500 dark:text-rose-300 max-w-xs">{error}</span>
                        <button
                            onClick={() => setReloadKey(k => k + 1)}
                            className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-[11px] font-bold"
                        >
                            <RefreshCw size={14} /> تلاش مجدد
                        </button>
                    </div>
                ) : (
                    <AnimatePresence mode="wait" initial={false}>
                        {filteredPdfs.length === 0 ? (
                            <motion.div
                                key="empty-state"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={fadeTransition}
                                className="py-16 flex flex-col items-center justify-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl text-center"
                            >
                                <div className="w-12 h-12 rounded-full bg-[var(--bg-element)] flex items-center justify-center text-[var(--text-muted)]">
                                    <Inbox size={22} />
                                </div>
                                <span className="text-xs font-bold text-[var(--text-primary)]">فایلی پیدا نشد!</span>
                                <span className="text-[11px] text-[var(--text-muted)]">
                                    {pdfs.length === 0
                                        ? 'هنوز فایلی در کتابخانه منتشر نشده است. به‌زودی محتوای جدید اضافه می‌شود.'
                                        : 'لطفاً عبارت دیگری را جستجو کنید یا فیلتر را تغییر دهید.'}
                                </span>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={`grid-${activeCategory}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={fadeTransition}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                            >
                                {filteredPdfs.map((pdf) => (
                                    <div
                                        key={pdf.id}
                                        className="group bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/50 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-colors duration-200 shadow-sm"
                                    >
                                        {/* Card Header Info */}
                                        <div className="space-y-3">

                                            {/* Icon + Badges */}
                                            <div className="flex items-center justify-between">
                                                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                                                    <FileText size={18} strokeWidth={2} />
                                                </div>
                                                <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full ${
                                                    pdf.category === 'pamphlet'
                                                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                                        : pdf.category === 'exam'
                                                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                    {pdf.categoryLabel}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-medium">
                                                <span>{pdf.grade}</span>
                                                <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                                                <span className="text-[var(--accent)] font-bold">{pdf.subject}</span>
                                            </div>

                                            {/* Title and Description */}
                                            <div className="space-y-1.5 text-right">
                                                <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                                                    {pdf.title}
                                                </h3>
                                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed h-12 overflow-hidden line-clamp-2">
                                                    {pdf.description}
                                                </p>
                                            </div>

                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-[var(--border)]/70 pt-3 flex flex-col gap-3">

                                            {/* Metadata Footer */}
                                            <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-[var(--text-muted)]">
                                                <div className="flex flex-col items-center justify-center p-1.5 bg-[var(--bg-element)]/50 rounded-lg">
                                                    <span className="text-[9px] mb-0.5">اندازه</span>
                                                    <span className="font-bold text-[var(--text-primary)]">{pdf.fileSize || '—'}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-1.5 bg-[var(--bg-element)]/50 rounded-lg">
                                                    <span className="text-[9px] mb-0.5">تعداد صفحات</span>
                                                    <span className="font-bold text-[var(--text-primary)]">{pdf.pages > 0 ? `${pdf.pages} صفحه` : '—'}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-1.5 bg-[var(--bg-element)]/50 rounded-lg">
                                                    <span className="text-[9px] mb-0.5">تاریخ انتشار</span>
                                                    <span className="font-bold text-[var(--text-primary)]">{pdf.uploadedAt || '—'}</span>
                                                </div>
                                            </div>

                                            {/* Download Button */}
                                            <button
                                                onClick={() => handleDownload(pdf)}
                                                className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent)]/95 text-white rounded-xl text-[11px] font-bold shadow-sm shadow-[var(--accent)]/20 transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                                            >
                                                <Download size={14} />
                                                <span>دانلود فایل</span>
                                            </button>

                                        </div>

                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}

            </div>
        </div>
    );
};