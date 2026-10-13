import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, Flag, ChevronLeft, Type,
    Wrench, FileQuestion, Calendar, AlertTriangle, MessageSquare, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { flowApi } from '../lib/authApi'; // Added API import

// --- Types ---
type ReportStatus = 'pending' | 'resolved' | 'rejected' | 'investigating'; // Added investigating just in case your DB uses it
type IssueType = 'wrong_answer' | 'typo' | 'technical' | 'other' | 'unclear';
type FilterOption = 'all' | ReportStatus;

interface Report {
    id: number;
    questionText: string;
    reportText: string;
    issueType: IssueType;
    status: ReportStatus;
    date: string;
    timestamp: number;
}

// --- Helpers (Clean Badges) ---
const getStatusConfig = (status: ReportStatus) => {
    switch (status) {
        case 'pending': return { label: 'در حال بررسی', classes: 'bg-amber-50 border-amber-200/60 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400' };
        case 'investigating': return { label: 'در حال بررسی', classes: 'bg-blue-50 border-blue-200/60 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400' };
        case 'resolved': return { label: 'اصلاح شد', classes: 'bg-emerald-50 border-emerald-200/60 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' };
        case 'rejected': return { label: 'رد شده', classes: 'bg-rose-50 border-rose-200/60 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' };
        default: return { label: 'نامشخص', classes: 'bg-gray-50 border-gray-200/60 text-gray-700 dark:bg-gray-500/10 dark:border-gray-500/20 dark:text-gray-400' };
    }
};

const getIssueTypeConfig = (type: IssueType) => {
    switch (type) {
        case 'wrong_answer': return { label: 'ایراد علمی / پاسخ', icon: FileQuestion, classes: 'text-purple-700 bg-purple-50 border-purple-200/60 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-400' };
        case 'typo': return { label: 'غلط املایی / نگارشی', icon: Type, classes: 'text-blue-700 bg-blue-50 border-blue-200/60 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400' };
        case 'technical': return { label: 'مشکل فنی / تصویر', icon: Wrench, classes: 'text-orange-700 bg-orange-50 border-orange-200/60 dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-400' };
        case 'unclear': return { label: 'گنگ بودن سوال', icon: AlertTriangle, classes: 'text-indigo-700 bg-indigo-50 border-indigo-200/60 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400' };
        case 'other':
        default: return { label: 'سایر موارد', icon: AlertTriangle, classes: 'text-gray-700 bg-gray-50 border-gray-200/60 dark:bg-gray-500/10 dark:border-gray-500/20 dark:text-gray-400' };
    }
};

interface ReportsViewProps {
    onBack: () => void;
}

export function ReportsView({ onBack }: ReportsViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterBy, setFilterBy] = useState<FilterOption>('all');

    // --- API States ---
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Fetch Data ---
    useEffect(() => {
        const fetchReports = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await flowApi.dispatch('get_reports');
                if (response.success) {
                    // Map API response to match the template's required properties (like formatting the date)
                    const mappedReports = response.data.map((r: any) => ({
                        ...r,
                        date: new Date(r.timestamp).toLocaleDateString('fa-IR')
                    }));
                    setReports(mappedReports);
                } else {
                    setError(response.message || 'خطا در دریافت گزارش‌ها');
                }
            } catch (err: any) {
                setError(err.message || 'خطای شبکه در ارتباط با سرور');
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, []);

    const processedReports = useMemo(() => {
        let result = reports.filter(r =>
            (r.questionText && r.questionText.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (r.reportText && r.reportText.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        if (filterBy !== 'all') {
            result = result.filter(r => r.status === filterBy);
        }

        return result.sort((a, b) => b.timestamp - a.timestamp);
    }, [reports, searchQuery, filterBy]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (typeof window !== 'undefined' && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
                (window as any).MathJax.typesetPromise().catch((err: any) => console.error('MathJax typeset error:', err));
            }
        }, 100);
        return () => clearTimeout(timeout);
    }, [processedReports]);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">

                    {/* Header Section */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex lg:hidden items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                                    <Flag size={22} className="fill-orange-500/20" />
                                </div>
                                <h1 className="text-xl font-black text-[var(--text-primary)]">گزارش‌های من</h1>
                            </div>
                            <button
                                onClick={onBack}
                                className="w-10 p-0 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--color-primary-500)] hover:text-white transition-colors">
                                <ChevronLeft size={26} strokeWidth={2.5} className="mr-0.5" />
                            </button>
                        </div>

                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
                            <div className="flex items-center w-full lg:w-auto p-1.5 bg-[var(--bg-element)]/60 border border-[var(--border)]/50 rounded-2xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {(Object.entries({ all: 'همه', pending: 'در حال بررسی', resolved: 'حل شده', rejected: 'رد شده' }) as [FilterOption, string][]).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilterBy(key)}
                                        className="relative px-5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-colors duration-300 flex-1 lg:flex-none text-center">
                                        {filterBy === key && (
                                            <motion.div
                                                layoutId="activeFilterIndicator"
                                                className="absolute inset-0 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
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
                                    type="text" placeholder="جستجو در سوال یا گزارش..." value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-12 bg-[var(--bg-element)]/30 border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-2xl pr-11 pl-4 focus:outline-none focus:bg-[var(--bg-card)] focus:border-[var(--color-primary-500)] focus:ring-4 focus:ring-[var(--color-primary-500)]/10 transition-all duration-300 placeholder:text-[var(--text-muted)]"
                                />
                            </div>
                        </motion.div>

                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onBack}
                                       className="hidden lg:flex group items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-300">
                            <span className="text-sm font-bold">بازگشت</span>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-element)] group-hover:bg-[var(--color-primary-500)] group-hover:text-white transition-colors duration-300 border border-[var(--border)] group-hover:border-transparent">
                                <ChevronLeft size={26} strokeWidth={2.5} className="mr-0.5 group-hover:-translate-x-0.5 transition-transform duration-300" />
                            </div>
                        </motion.button>
                    </div>

                    {/* Main Content Area: Loading / Error / Data / Empty */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Loader2 size={32} className="animate-spin text-[var(--color-primary-500)] mb-4" />
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">در حال دریافت گزارش‌ها...</h3>
                        </div>
                    ) : error ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-rose-50/50 dark:bg-rose-500/5 rounded-3xl border border-rose-200 dark:border-rose-500/20 border-dashed">
                            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mb-5">
                                <AlertTriangle size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2">مشکلی پیش آمد</h3>
                            <p className="text-xs text-rose-500 dark:text-rose-300 max-w-xs leading-relaxed">{error}</p>
                        </motion.div>
                    ) : processedReports.length > 0 ? (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                <table className="w-full text-right min-w-[950px] border-collapse">
                                    <thead>
                                    <tr className="bg-[var(--bg-element)]/50 border-b border-[var(--border)] text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4">سوال</th>
                                        <th className="px-6 py-4">متن گزارش</th>
                                        <th className="px-6 py-4">نوع مشکل</th>
                                        <th className="px-6 py-4 text-center">وضعیت</th>
                                        <th className="px-6 py-4 text-left">تاریخ</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                    {/* Added AnimatePresence to handle mounting/unmounting gracefully */}
                                    <AnimatePresence mode="popLayout">
                                        {processedReports.map((report) => {
                                            const status = getStatusConfig(report.status);
                                            const issue = getIssueTypeConfig(report.issueType);
                                            const IssueIcon = issue.icon;

                                            return (
                                                <motion.tr
                                                    key={report.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                    className="hover:bg-[var(--bg-element)]/30 transition-colors duration-200"
                                                >
                                                    <td className="px-6 py-5 align-top min-w-[250px]">
                                                        {/* Using dangerouslySetInnerHTML avoids React and MathJax DOM mismatch crashes */}
                                                        <p
                                                            className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed line-clamp-2"
                                                            dangerouslySetInnerHTML={{ __html: report.questionText || 'متن سوال در دسترس نیست' }}
                                                        />
                                                    </td>
                                                    <td className="px-6 py-5 align-top min-w-[300px] max-w-sm">
                                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-element)]/40 border border-[var(--border)]/50">
                                                            <MessageSquare size={16} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                                                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-normal">{report.reportText}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${issue.classes}`}>
                                                            <IssueIcon size={14} strokeWidth={2.5} />
                                                            <span>{issue.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top text-center">
                                                        <div className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold min-w-[90px] ${status.classes}`}>
                                                            {status.label}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top text-left whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2 text-xs font-medium text-[var(--text-muted)]">
                                                            <Calendar size={14} />
                                                            <span>{report.date}</span>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] border-dashed">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-element)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                                <Flag size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">گزارشی یافت نشد</h3>
                            <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                                {searchQuery || filterBy !== 'all'
                                    ? 'نتیجه‌ای برای جستجو یا فیلتر فعلی یافت نشد.'
                                    : 'شما هنوز هیچ گزارشی ثبت نکرده‌اید.'}
                            </p>
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
    );
}
