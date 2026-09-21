import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, ChevronDown, ChevronLeft, Edit3, Filter, Globe,
    ListFilter, Loader2, Play, Plus, Search, ShieldCheck, SlidersHorizontal,
    Trash2, Users, Check, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../../lib/authApi';
import { useNavigate } from 'react-router-dom';
import { createLobby } from '../../socket/lobby.socket';
import { useSocket } from '../../socket/useSocket';
import { QuizCountdown } from '../../components/QuizCountdown';
import MathRenderer from '../../components/ui/MathRenderer';

type BankQuestion = {
    id: number;
    text: string;
    difficulty: string;
    subject_id?: number;
    grade_id?: number;
    topic_id?: number;
    chapter_id?: number;
    subject_title?: string;
    grade_title?: string;
    topic_title?: string;
    chapter_title?: string;
    image?: string | null;
    options?: { id: number; text: string }[];
};

type FilterOption = { id: number | string; title: string };

const DIFFICULTIES = ['آسان', 'متوسط', 'سخت'] as const;
const PAGE_SIZE = 12;
const MAX_SELECTED = 50;
const IMAGE_BASE = '/images/questions/';

const toIds = (list: Array<string | number>) =>
    list.map(Number).filter((n) => Number.isInteger(n) && n > 0);

function waitForSocketConnection(socket: any, timeout = 7000) {
    return new Promise<void>((resolve, reject) => {
        if (socket.connected) { resolve(); return; }
        const timer = setTimeout(() => { cleanup(); reject(new Error('اتصال لحظه‌ای برقرار نشد.')); }, timeout);
        const onConnect = () => { cleanup(); resolve(); };
        const onError = (err: any) => { cleanup(); reject(err); };
        const cleanup = () => { clearTimeout(timer); socket.off('connect', onConnect); socket.off('connect_error', onError); };
        socket.on('connect', onConnect);
        socket.on('connect_error', onError);
        socket.connect();
    });
}

const difficultyTone = (level: string) => {
    if (level === 'آسان') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (level === 'سخت') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
};

function FilterBlock({
    title,
    children,
    defaultOpen = true,
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-[var(--border)] last:border-b-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between py-3 text-sm font-bold text-[var(--text-primary)]"
            >
                {title}
                <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="pb-3 space-y-1.5">{children}</div>}
        </div>
    );
}

function ChipList({
    items,
    selected,
    onToggle,
    emptyLabel,
}: {
    items: FilterOption[];
    selected: Array<string | number>;
    onToggle: (id: string | number) => void;
    emptyLabel?: string;
}) {
    if (items.length === 0) {
        return <p className="text-[11px] text-[var(--text-muted)] px-1">{emptyLabel || 'ابتدا فیلتر بالاتر را انتخاب کنید.'}</p>;
    }
    return (
        <div className="flex flex-col gap-1 max-h-44 overflow-y-auto [&::-webkit-scrollbar]:hidden">
            {items.map((item) => {
                const active = selected.map(String).includes(String(item.id));
                return (
                    <button
                        key={String(item.id)}
                        type="button"
                        onClick={() => onToggle(item.id)}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                            active
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--bg-element)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                        }`}
                    >
                        {item.title}
                    </button>
                );
            })}
        </div>
    );
}

export function QuestionSelectorView({
    shareCode,
    onBack,
}: {
    shareCode: string;
    onBack?: () => void;
}) {
    const navigate = useNavigate();
    const { socket, connect } = useSocket();

    const [subjects, setSubjects] = useState<FilterOption[]>([]);
    const [grades, setGrades] = useState<FilterOption[]>([]);
    const [chapters, setChapters] = useState<FilterOption[]>([]);
    const [mabhas, setMabhas] = useState<FilterOption[]>([]);

    const [selectedSubjects, setSelectedSubjects] = useState<Array<string | number>>([]);
    const [selectedGrades, setSelectedGrades] = useState<Array<string | number>>([]);
    const [selectedChapters, setSelectedChapters] = useState<Array<string | number>>([]);
    const [selectedMabhas, setSelectedMabhas] = useState<Array<string | number>>([]);
    const [difficulties, setDifficulties] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<'manual' | 'auto'>('manual');
    const [autoCount, setAutoCount] = useState(10);
    const [filtersOpen, setFiltersOpen] = useState(true);

    const [questions, setQuestions] = useState<BankQuestion[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [showAnswers, setShowAnswers] = useState(false);

    const [selected, setSelected] = useState<BankQuestion[]>([]);
    const [time, setTime] = useState(30);
    const [isCustomTime, setIsCustomTime] = useState(false);
    const [visibility, setVisibility] = useState<'private' | 'public'>('private');
    const [memberLimit, setMemberLimit] = useState(10);
    const [quizName, setQuizName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [showStartCountdown, setShowStartCountdown] = useState(false);
    const [createdPrivateQuizId, setCreatedPrivateQuizId] = useState<string | null>(null);

    const selectedIds = useMemo(() => new Set(selected.map((q) => q.id)), [selected]);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const toggleIn = (list: Array<string | number>, id: string | number) =>
        list.map(String).includes(String(id)) ? list.filter((x) => String(x) !== String(id)) : [...list, id];

    useEffect(() => {
        (async () => {
            try {
                const res = await flowApi.dispatch('get_subjects');
                const raw = res.subjects || res.data || [];
                setSubjects(raw.map((s: any) => ({ id: Number(s.id), title: s.title || s.name })).filter((s: FilterOption) => Number(s.id) > 0));
            } catch {
                toast.error('دریافت درس‌ها ناموفق بود.');
            }
        })();
    }, []);

    useEffect(() => {
        if (selectedSubjects.length === 0) {
            setGrades([]);
            setSelectedGrades([]);
            return;
        }
        (async () => {
            const res = await flowApi.dispatch('get_grades_by_subjects_multi', {
                subjects: selectedSubjects,
                subject_ids: toIds(selectedSubjects),
            });
            const raw = res.grades || [];
            setGrades(raw.map((g: any) => ({ id: Number(g.id), title: g.title })).filter((g: FilterOption) => Number(g.id) > 0));
            setSelectedGrades((prev) => prev.filter((id) => raw.some((g: any) => String(g.id) === String(id))));
        })();
    }, [selectedSubjects]);

    useEffect(() => {
        if (selectedSubjects.length === 0) {
            setChapters([]);
            setSelectedChapters([]);
            return;
        }
        (async () => {
            const res = await flowApi.dispatch('get_chapters_by_subjects_multi', {
                subjects: selectedSubjects,
                subject_ids: toIds(selectedSubjects),
                grades: selectedGrades,
                grade_ids: toIds(selectedGrades),
            });
            const raw = res.chapters || [];
            setChapters(raw.map((c: any) => ({ id: Number(c.id), title: c.title })).filter((c: FilterOption) => Number(c.id) > 0));
            setSelectedChapters((prev) => prev.filter((id) => raw.some((c: any) => String(c.id) === String(id))));
        })();
    }, [selectedSubjects, selectedGrades]);

    useEffect(() => {
        if (selectedChapters.length === 0) {
            setMabhas([]);
            setSelectedMabhas([]);
            return;
        }
        (async () => {
            const res = await flowApi.dispatch('get_mabahes_by_chapters_multi', {
                chapters: selectedChapters,
                topic_ids: toIds(selectedChapters),
                grades: selectedGrades,
                grade_ids: toIds(selectedGrades),
            });
            const raw = res.mabahes || [];
            setMabhas(raw.map((m: any) => ({ id: Number(m.id), title: m.title })).filter((m: FilterOption) => Number(m.id) > 0));
            setSelectedMabhas((prev) => prev.filter((id) => raw.some((m: any) => String(m.id) === String(id))));
        })();
    }, [selectedChapters, selectedGrades]);

    const fetchQuestions = useCallback(async (nextPage = 1, opts?: { includeOptions?: boolean; keepSelection?: boolean }) => {
        if (toIds(selectedSubjects).length === 0) {
            setQuestions([]);
            setTotal(0);
            setHasApplied(false);
            return;
        }
        setLoading(true);
        try {
            const payload: any = {
                subject_ids: toIds(selectedSubjects),
                grade_ids: toIds(selectedGrades),
                topic_ids: toIds(selectedChapters),
                chapter_ids: toIds(selectedMabhas),
                subjects: toIds(selectedSubjects),
                grades: toIds(selectedGrades),
                chapters: toIds(selectedChapters),
                mabhas: toIds(selectedMabhas),
                difficulties,
                search: search.trim(),
                includeOptions: opts?.includeOptions ?? showAnswers,
            };
            if (mode === 'auto') {
                payload.sample = true;
                payload.sampleSize = autoCount;
            } else {
                payload.page = nextPage;
                payload.pageSize = PAGE_SIZE;
            }
            const res = await flowApi.dispatch('search_bank_questions', payload);
            if (!res?.success) {
                toast.error(res?.message || 'دریافت سوالات ناموفق بود.');
                return;
            }
            const list: BankQuestion[] = Array.isArray(res.questions)
                ? res.questions
                : Array.isArray(res.data?.questions)
                    ? res.data.questions
                    : [];
            const rawTotal = res.pagination?.total ?? res.data?.pagination?.total;
            setQuestions(list);
            setTotal(rawTotal == null ? list.length : Number(rawTotal) || 0);
            setPage(nextPage);
            setHasApplied(true);
            if (mode === 'auto' && !opts?.keepSelection) {
                setSelected(list.slice(0, MAX_SELECTED));
                toast.success(`${Math.min(list.length, MAX_SELECTED)} سوال به‌صورت خودکار انتخاب شد.`);
            }
        } catch {
            toast.error('ارتباط با سرور برقرار نشد.');
        } finally {
            setLoading(false);
        }
    }, [selectedSubjects, selectedGrades, selectedChapters, selectedMabhas, difficulties, search, mode, autoCount, showAnswers]);

    useEffect(() => {
        if (selectedSubjects.length === 0) {
            setQuestions([]);
            setTotal(0);
            setHasApplied(false);
            return;
        }
        const timer = window.setTimeout(() => {
            fetchQuestions(1, { keepSelection: true });
        }, 250);
        return () => window.clearTimeout(timer);
    }, [fetchQuestions, selectedSubjects.length]);

    const applyFilters = () => {
        if (selectedSubjects.length === 0) {
            toast.error('حداقل یک درس را انتخاب کنید.');
            return;
        }
        fetchQuestions(1);
    };

    const toggleQuestion = (question: BankQuestion) => {
        setSelected((prev) => {
            if (prev.some((q) => q.id === question.id)) return prev.filter((q) => q.id !== question.id);
            if (prev.length >= MAX_SELECTED) {
                toast.error(`حداکثر ${MAX_SELECTED} سوال می‌توانید انتخاب کنید.`);
                return prev;
            }
            return [...prev, question];
        });
    };

    const addVisible = () => {
        setSelected((prev) => {
            const next = [...prev];
            for (const q of questions) {
                if (next.length >= MAX_SELECTED) break;
                if (!next.some((x) => x.id === q.id)) next.push(q);
            }
            return next;
        });
    };

    const handleStartQuiz = async () => {
        if (selected.length === 0) {
            toast.error('حداقل یک سوال انتخاب کنید.');
            return;
        }
        if (!time || time <= 0) {
            toast.error('زمان آزمون را مشخص کنید.');
            return;
        }
        setIsCreating(true);
        const loadingToastId = toast.loading('درحال ساخت آزمون...');
        try {
            const payload = {
                action: 'create_quiz',
                quizType: 'selector',
                question_ids: selected.map((q) => q.id),
                lessons: selectedSubjects,
                grades: selectedGrades,
                chapters: selectedChapters,
                mabhas: selectedMabhas,
                shareCode,
                settings: {
                    time,
                    difficulty: 2,
                    visibility,
                    memberLimit,
                    quizName,
                    questionCounts: { bank: selected.length },
                },
            };
            const res = await flowApi.dispatch('create_quiz', payload);
            if (!res?.success) {
                toast.error(res?.message || 'ساخت آزمون ناموفق بود.', { id: loadingToastId });
                return;
            }
            const createdQuizId =
                res.quiz?.id || res.quiz?._id || res.data?.quizId || res.data?.id ||
                res.data?._id || res.data?.quiz?.id || res.data?.quiz?._id;
            if (!createdQuizId) {
                toast.error('شناسه آزمون ساخته‌شده پیدا نشد.', { id: loadingToastId });
                return;
            }
            if (visibility === 'private') {
                toast.success('آزمون با موفقیت ساخته شد.', { id: loadingToastId });
                setCreatedPrivateQuizId(String(createdQuizId));
                setShowStartCountdown(true);
                return;
            }
            toast.loading('در حال ساخت لابی...', { id: loadingToastId });
            let activeSocket = socket || connect();
            if (!activeSocket) {
                toast.error('اتصال لحظه‌ای در دسترس نیست.', { id: loadingToastId });
                return;
            }
            if (!activeSocket.connected) await waitForSocketConnection(activeSocket);
            const lobby = await createLobby(activeSocket, {
                quizId: String(createdQuizId),
                code: String(shareCode),
                maxMembers: memberLimit,
            });
            toast.success('آزمون و لابی ساخته شدند', { id: loadingToastId });
            navigate(`/lobby/${lobby.code}`);
        } catch (error: any) {
            toast.error(error?.message || 'خطا در ارتباط با سرور', { id: loadingToastId });
        } finally {
            setIsCreating(false);
        }
    };

    if (showStartCountdown && createdPrivateQuizId) {
        return <QuizCountdown durationMs={3000} onComplete={() => navigate(`/quiz/${createdPrivateQuizId}`)} />;
    }

    return (
        <div className="w-full min-h-full bg-[var(--bg-app)] pb-36 lg:pb-28" dir="rtl">
            <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-6 pt-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">بانک سوال</h3>
                        <p className="text-[12px] text-[var(--text-muted)] mt-1">فیلتر کن، اعمال کن، سوال‌ها را ببین و آزمون بساز.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen((v) => !v)}
                            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[12px] font-bold"
                        >
                            <SlidersHorizontal size={14} />
                            فیلترها
                        </button>
                        {onBack && (
                            <button type="button" onClick={onBack} className="p-2 rounded-xl bg-[var(--bg-element)] text-[var(--text-secondary)]">
                                <ChevronLeft size={18} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 items-start pb-36 lg:pb-28">
                    <aside className={`w-full lg:w-[300px] shrink-0 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
                        <div className="lg:sticky lg:top-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col max-h-[min(70vh,calc(100vh-10rem))]">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                                    <Filter size={16} className="text-[var(--accent)]" />
                                    فیلتر سوالات
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSubjects([]);
                                        setSelectedGrades([]);
                                        setSelectedChapters([]);
                                        setSelectedMabhas([]);
                                        setDifficulties([]);
                                        setSearch('');
                                    }}
                                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--error)]"
                                >
                                    حذف فیلترها
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden mt-3">
                            <div className="flex bg-[var(--bg-element)] p-1 rounded-xl mb-3">
                                {[
                                    { id: 'manual', label: 'انتخاب دستی', icon: ListFilter },
                                    { id: 'auto', label: 'انتخاب خودکار', icon: Activity },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setMode(tab.id as 'manual' | 'auto')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold ${
                                            mode === tab.id ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'
                                        }`}
                                    >
                                        <tab.icon size={13} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="relative mb-2">
                                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="جستجو در متن سوال"
                                    className="w-full bg-[var(--bg-element)] border border-[var(--border)] rounded-xl pr-8 pl-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                />
                            </div>

                            <FilterBlock title="درس">
                                <ChipList items={subjects} selected={selectedSubjects} onToggle={(id) => setSelectedSubjects((p) => toggleIn(p, id))} emptyLabel="درسی یافت نشد." />
                            </FilterBlock>
                            <FilterBlock title="پایه">
                                <ChipList items={grades} selected={selectedGrades} onToggle={(id) => setSelectedGrades((p) => toggleIn(p, id))} />
                            </FilterBlock>
                            <FilterBlock title="فصل" defaultOpen={false}>
                                <ChipList items={chapters} selected={selectedChapters} onToggle={(id) => setSelectedChapters((p) => toggleIn(p, id))} />
                            </FilterBlock>
                            <FilterBlock title="مبحث" defaultOpen={false}>
                                <ChipList items={mabhas} selected={selectedMabhas} onToggle={(id) => setSelectedMabhas((p) => toggleIn(p, id))} />
                            </FilterBlock>
                            <FilterBlock title="سطح دشواری">
                                <div className="flex gap-1.5">
                                    {DIFFICULTIES.map((d) => {
                                        const active = difficulties.includes(d);
                                        return (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDifficulties((p) => (active ? p.filter((x) => x !== d) : [...p, d]))}
                                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${
                                                    active ? difficultyTone(d) : 'bg-[var(--bg-element)] text-[var(--text-muted)]'
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        );
                                    })}
                                </div>
                            </FilterBlock>

                            {mode === 'auto' && (
                                <div className="pt-3">
                                    <div className="flex items-center justify-between text-[12px] font-bold text-[var(--text-primary)] mb-2">
                                        <span>تعداد سوال خودکار</span>
                                        <span className="text-[var(--accent)]">{autoCount}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={MAX_SELECTED}
                                        value={autoCount}
                                        onChange={(e) => setAutoCount(Number(e.target.value))}
                                        className="w-full accent-[var(--accent)]"
                                    />
                                </div>
                            )}
                            </div>

                            <button
                                type="button"
                                onClick={applyFilters}
                                disabled={loading}
                                className="mt-3 w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
                                اعمال فیلتر
                            </button>
                        </div>
                    </aside>

                    <section className="flex-1 min-w-0 w-full space-y-3">
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[12px] font-bold text-[var(--text-primary)]">
                                {hasApplied ? `${total} سوال مطابق فیلتر` : 'هنوز فیلتری اعمال نشده'}
                                {selected.length > 0 && (
                                    <span className="mr-2 text-[var(--accent)]">· {selected.length} انتخاب‌شده</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = !showAnswers;
                                        setShowAnswers(next);
                                        if (next && hasApplied) fetchQuestions(page, { includeOptions: true, keepSelection: true });
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                                        showAnswers ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[var(--text-muted)]'
                                    }`}
                                >
                                    {showAnswers ? 'نمایش سوال' : 'نمایش پاسخ'}
                                </button>
                                {mode === 'manual' && questions.length > 0 && (
                                    <button type="button" onClick={addVisible} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--bg-element)]">
                                        افزودن همین صفحه
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading && (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />)}
                            </div>
                        )}

                        {!loading && !hasApplied && (
                            <div className="text-center py-16 bg-[var(--bg-card)] border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
                                درس و فیلترها را از ستون کناری انتخاب کن. سوال‌ها بلافاصله نمایش داده می‌شوند.
                            </div>
                        )}

                        {!loading && hasApplied && questions.length === 0 && (
                            <div className="text-center py-16 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
                                سوالی با این فیلتر پیدا نشد. فیلتر را عوض کن و دوباره اعمال کن.
                            </div>
                        )}

                        <AnimatePresence>
                            {!loading && questions.map((q, idx) => {
                                const isOn = selectedIds.has(q.id);
                                return (
                                    <motion.article
                                        key={q.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`bg-[var(--bg-card)] border rounded-2xl p-4 shadow-sm ${
                                            isOn ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                <span className="font-black text-[var(--text-muted)]">{((page - 1) * PAGE_SIZE) + idx + 1}</span>
                                                {q.subject_title && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-element)]">{q.subject_title}</span>}
                                                {q.grade_title && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-element)]">{q.grade_title}</span>}
                                                {q.topic_title && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-element)]">{q.topic_title}</span>}
                                                <span className={`px-2 py-0.5 rounded-md font-bold ${difficultyTone(q.difficulty)}`}>{q.difficulty}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => toggleQuestion(q)}
                                                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                                    isOn ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-element)] text-[var(--accent)]'
                                                }`}
                                                aria-label={isOn ? 'حذف از آزمون' : 'افزودن به آزمون'}
                                            >
                                                {isOn ? <Check size={16} /> : <Plus size={16} />}
                                            </button>
                                        </div>
                                        <div className="text-[13px] text-[var(--text-primary)] leading-7">
                                            <MathRenderer text={q.text} />
                                        </div>
                                        {q.image && (
                                            <img
                                                src={`${IMAGE_BASE}${q.image}`}
                                                alt=""
                                                className="mt-3 max-h-48 object-contain rounded-xl border border-[var(--border)] bg-white"
                                            />
                                        )}
                                        {showAnswers && q.options && q.options.length > 0 && (
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {q.options.map((opt, i) => (
                                                    <div key={opt.id} className="px-3 py-2 rounded-xl bg-[var(--bg-element)] text-[12px] text-[var(--text-secondary)]">
                                                        <span className="font-bold ml-1">{i + 1})</span>
                                                        <MathRenderer text={opt.text} inline />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.article>
                                );
                            })}
                        </AnimatePresence>

                        {mode === 'manual' && hasApplied && pageCount > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button
                                    type="button"
                                    disabled={page <= 1 || loading}
                                    onClick={() => fetchQuestions(page - 1)}
                                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-element)] text-[12px] disabled:opacity-40"
                                >
                                    قبلی
                                </button>
                                <span className="text-[12px] text-[var(--text-muted)]">صفحه {page} از {pageCount}</span>
                                <button
                                    type="button"
                                    disabled={page >= pageCount || loading}
                                    onClick={() => fetchQuestions(page + 1)}
                                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-element)] text-[12px] disabled:opacity-40"
                                >
                                    بعدی
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <div className="fixed bottom-16 lg:bottom-4 left-3 right-3 lg:left-auto lg:right-[max(1rem,calc((100vw-1500px)/2+1rem))] lg:w-[min(720px,calc(100vw-340px))] z-40">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] shadow-xl rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--text-primary)] min-w-[110px]">
                        <BookOpen size={16} className="text-[var(--accent)]" />
                        {selected.length} / {MAX_SELECTED} سوال
                    </div>
                    <input
                        value={quizName}
                        onChange={(e) => setQuizName(e.target.value)}
                        placeholder="نام آزمون (اختیاری)"
                        className="flex-1 min-w-0 bg-[var(--bg-element)] border border-[var(--border)] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex items-center gap-1">
                        {[10, 20, 30].map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => { setIsCustomTime(false); setTime(t); }}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold ${!isCustomTime && time === t ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-element)] text-[var(--text-muted)]'}`}
                            >
                                {t}د
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setIsCustomTime(true)}
                            className={`p-1.5 rounded-lg ${isCustomTime ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-element)] text-[var(--text-muted)]'}`}
                        >
                            <Edit3 size={13} />
                        </button>
                        {isCustomTime && (
                            <input
                                type="number"
                                value={time || ''}
                                onChange={(e) => setTime(parseInt(e.target.value, 10) || 0)}
                                className="w-14 bg-[var(--bg-element)] border border-[var(--border)] rounded-lg px-1 py-1 text-[11px] text-center"
                            />
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setVisibility((v) => (v === 'private' ? 'public' : 'private'))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-element)] text-[11px] font-bold text-[var(--text-secondary)]"
                    >
                        {visibility === 'private' ? <ShieldCheck size={13} /> : <Globe size={13} />}
                        {visibility === 'private' ? 'شخصی' : 'عمومی'}
                    </button>
                    {visibility === 'public' && (
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                            <Users size={13} />
                            <select
                                value={memberLimit}
                                onChange={(e) => setMemberLimit(Number(e.target.value))}
                                className="bg-[var(--bg-element)] rounded-lg px-1 py-1"
                            >
                                <option value={5}>۵</option>
                                <option value={10}>۱۰</option>
                                <option value={15}>۱۵</option>
                            </select>
                        </div>
                    )}
                    {selected.length > 0 && (
                        <button type="button" onClick={() => setSelected([])} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)]">
                            <Trash2 size={15} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleStartQuiz}
                        disabled={isCreating || selected.length === 0}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[13px] font-bold disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="rotate-180" />}
                        {visibility === 'public' ? 'ساخت آزمون' : 'ساخت و شروع'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default QuestionSelectorView;
