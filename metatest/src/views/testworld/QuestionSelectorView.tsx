import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Copy,
    Library, Loader2, Play, Search, SlidersHorizontal, Trash2, Users, X,
    type LucideIcon,
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
type SavedPick = { code: string; title: string; count: number; updatedAt?: string };

const DIFFICULTIES = ['آسان', 'متوسط', 'سخت'] as const;
const PAGE_SIZE = 12;
const MAX_SELECTED = 50;
const IMAGE_BASE = '/images/questions/';
const fa = (value: number) => value.toLocaleString('fa-IR');

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
    if (level === 'آسان') return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    if (level === 'سخت') return 'bg-rose-500/12 text-rose-700 dark:text-rose-300';
    return 'bg-violet-500/12 text-violet-700 dark:text-violet-300';
};

function CheckRow({
    checked,
    label,
    onToggle,
}: {
    checked: boolean;
    label: string;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onToggle}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-right transition-colors hover:bg-[var(--bg-element)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
            <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-all duration-200 ${
                    checked
                        ? 'scale-100 border-[var(--accent)] bg-[var(--accent)]'
                        : 'scale-95 border-[var(--border)] bg-[var(--bg-card)]'
                }`}
            >
                <Check className={`h-3.5 w-3.5 text-white transition-all duration-200 ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} strokeWidth={3} />
            </span>
            <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {label}
            </span>
        </button>
    );
}

function Switch({
    on,
    label,
    onClick,
    compact = false,
}: {
    on: boolean;
    label: string;
    onClick: () => void;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={onClick}
            className={`cursor-pointer items-center gap-2 border border-[var(--border)] bg-[var(--bg-element)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                compact
                    ? 'inline-flex h-10 shrink-0 rounded-xl px-3'
                    : 'flex w-full justify-between rounded-2xl px-3 py-2.5'
            }`}
        >
            <span className="text-[13px] font-bold text-[var(--text-primary)]">{label}</span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? '-translate-x-5' : 'translate-x-0'}`}
                    style={{ right: 2 }}
                />
            </span>
        </button>
    );
}

function Sheet({
    open,
    title,
    onClose,
    children,
}: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        aria-label="بستن"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/45 lg:hidden"
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[min(88dvh,760px)] flex-col rounded-t-[28px] border border-[var(--border)] bg-[var(--bg-card)] lg:hidden"
                        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                    >
                        <div className="flex items-center justify-between px-4 pb-2 pt-3">
                            <h3 className="text-sm font-black">{title}</h3>
                            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--bg-element)] p-0">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
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
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [showPicked, setShowPicked] = useState(false);

    const [questions, setQuestions] = useState<BankQuestion[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);

    const [selected, setSelected] = useState<BankQuestion[]>([]);
    const [time, setTime] = useState(30);
    const [isCustomTime, setIsCustomTime] = useState(false);
    const [visibility, setVisibility] = useState<'private' | 'public'>('private');
    const [memberLimit, setMemberLimit] = useState(10);
    const [quizName, setQuizName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [showStartCountdown, setShowStartCountdown] = useState(false);
    const [createdPrivateQuizId, setCreatedPrivateQuizId] = useState<string | null>(null);

    const preserveNextFetch = React.useRef(false);
    const lockSelection = React.useRef(false);
    const unlockSelection = () => { lockSelection.current = false; };
    const [savedCode, setSavedCode] = useState('');
    const [loadInput, setLoadInput] = useState('');
    const [mySaves, setMySaves] = useState<SavedPick[]>([]);
    const [saving, setSaving] = useState(false);

    const selectedIds = useMemo(() => new Set(selected.map((q) => q.id)), [selected]);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const toggleIn = (list: Array<string | number>, id: string | number) =>
        list.map(String).includes(String(id)) ? list.filter((x) => String(x) !== String(id)) : [...list, id];

    const refreshSaves = useCallback(async () => {
        try {
            const res = await flowApi.dispatch('list_bank_selections');
            if (res?.success && Array.isArray(res.items)) setMySaves(res.items);
        } catch {
            /* history is optional until the API is up */
        }
    }, []);

    useEffect(() => { refreshSaves(); }, [refreshSaves]);

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

    const fetchQuestions = useCallback(async (nextPage = 1, opts?: { keepSelection?: boolean; announce?: boolean }) => {
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
                includeOptions: true,
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
                if (opts?.announce !== false) {
                    toast.success(`${fa(Math.min(list.length, MAX_SELECTED))} سوال به‌صورت خودکار انتخاب شد.`);
                }
            }
        } catch {
            toast.error('ارتباط با سرور برقرار نشد.');
        } finally {
            setLoading(false);
        }
    }, [selectedSubjects, selectedGrades, selectedChapters, selectedMabhas, difficulties, search, mode, autoCount]);

    useEffect(() => {
        if (selectedSubjects.length === 0) {
            setQuestions([]);
            setTotal(0);
            setHasApplied(false);
            return;
        }
        const timer = window.setTimeout(() => {
            const keepSelection = lockSelection.current || preserveNextFetch.current || mode !== 'auto';
            preserveNextFetch.current = false;
            fetchQuestions(1, { keepSelection, announce: false });
        }, 250);
        return () => window.clearTimeout(timer);
    }, [fetchQuestions, selectedSubjects.length]);

    const toggleQuestion = (question: BankQuestion) => {
        setSelected((prev) => {
            if (prev.some((q) => q.id === question.id)) return prev.filter((q) => q.id !== question.id);
            if (prev.length >= MAX_SELECTED) {
                toast.error(`حداکثر ${fa(MAX_SELECTED)} سوال می‌توانید انتخاب کنید.`);
                return prev;
            }
            return [...prev, question];
        });
    };

    const addVisible = () => {
        const source = showPicked ? selected : questions;
        setSelected((prev) => {
            const next = [...prev];
            for (const q of source) {
                if (next.length >= MAX_SELECTED) break;
                if (!next.some((x) => x.id === q.id)) next.push(q);
            }
            return next;
        });
    };

    const currentSettings = () => ({
        subjectIds: selectedSubjects,
        gradeIds: selectedGrades,
        topicIds: selectedChapters,
        mabhasIds: selectedMabhas,
        difficulties,
        search,
        mode,
        autoCount,
        time,
        isCustomTime,
        visibility,
        memberLimit,
        quizName,
    });

    const saveSelection = async (asNew = false) => {
        if (selected.length === 0 && selectedSubjects.length === 0) {
            toast.error('اول سوال یا فیلتر را انتخاب کنید.');
            return;
        }
        setSaving(true);
        try {
            const res = await flowApi.dispatch('save_bank_selection', {
                code: asNew ? undefined : savedCode || undefined,
                title: quizName || 'انتخاب بانک تست',
                settings: currentSettings(),
                question_ids: selected.map((q) => q.id),
            });
            if (!res?.success || !res.code) {
                toast.error(res?.message || 'ذخیره انجام نشد.');
                return;
            }
            setSavedCode(res.code);
            toast.success(`کد ذخیره شد: ${res.code}`);
            refreshSaves();
        } catch {
            toast.error('ارتباط با سرور برقرار نشد.');
        } finally {
            setSaving(false);
        }
    };

    const applyLoaded = (res: any) => {
        const settings = res.settings || {};
        setSelectedSubjects(settings.subjectIds || []);
        setSelectedGrades(settings.gradeIds || []);
        setSelectedChapters(settings.topicIds || []);
        setSelectedMabhas(settings.mabhasIds || []);
        setDifficulties(settings.difficulties || []);
        setSearch(settings.search || '');
        setMode(settings.mode === 'auto' ? 'auto' : 'manual');
        setAutoCount(settings.autoCount || 10);
        setTime(settings.time || 30);
        setIsCustomTime(Boolean(settings.isCustomTime));
        setVisibility(settings.visibility === 'public' ? 'public' : 'private');
        setMemberLimit(settings.memberLimit || 10);
        setQuizName(settings.quizName || res.title || '');
        const loaded: BankQuestion[] = Array.isArray(res.questions) ? res.questions : [];
        setSelected(loaded.slice(0, MAX_SELECTED));
        preserveNextFetch.current = true;
        lockSelection.current = true;
        setShowPicked(true);
        setSavedCode(res.owned ? res.code : '');
        setHasApplied(true);
        toast.success('انتخاب‌ها و تنظیمات بارگذاری شد.');
    };

    const loadByCode = async (code: string) => {
        const clean = code.trim().toUpperCase();
        if (!clean) {
            toast.error('کد را وارد کنید.');
            return;
        }
        try {
            const res = await flowApi.dispatch('get_bank_selection', { code: clean });
            if (!res?.success) {
                toast.error(res?.message || 'این کد پیدا نشد.');
                return;
            }
            applyLoaded(res);
            setFiltersOpen(false);
            setSetupOpen(false);
        } catch {
            toast.error('ارتباط با سرور برقرار نشد.');
        }
    };

    const copyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            toast.success('کد کپی شد.');
        } catch {
            toast.error('کپی انجام نشد.');
        }
    };

    const handleStartQuiz = async () => {
        if (selected.length === 0) {
            toast.error('حداقل یک سوال انتخاب کنید.');
            return;
        }
        if (selected.length > MAX_SELECTED) {
            toast.error(`حداکثر ${fa(MAX_SELECTED)} سوال می‌توانید انتخاب کنید.`);
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

    const visibleQuestions = showPicked ? selected : questions;
    const pageNumbers = useMemo(() => {
        const start = Math.max(1, page - 2);
        const end = Math.min(pageCount, start + 4);
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }, [page, pageCount]);

    if (showStartCountdown && createdPrivateQuizId) {
        return <QuizCountdown durationMs={3000} onComplete={() => navigate(`/quiz/${createdPrivateQuizId}`)} />;
    }

    const renderFilters = () => (
        <div className="space-y-4">
            <Switch on={mode === 'auto'} label={mode === 'auto' ? 'انتخاب خودکار' : 'انتخاب دستی'} onClick={() => { unlockSelection(); setMode((value) => (value === 'manual' ? 'auto' : 'manual')); }} />
            <label className="relative block">
                <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                    value={search}
                    onChange={(event) => { unlockSelection(); setSearch(event.target.value); }}
                    placeholder="جستجو در متن سوال"
                    aria-label="جستجو در متن سوال"
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-app)] py-0 pr-9 pl-3 text-[13px] outline-none focus:border-[var(--accent)]"
                />
            </label>
            <FilterGroup title="درس" empty="درسی پیدا نشد.">
                {subjects.map((item) => (
                    <CheckRow key={String(item.id)} label={item.title} checked={selectedSubjects.map(String).includes(String(item.id))} onToggle={() => { unlockSelection(); setSelectedSubjects((prev) => toggleIn(prev, item.id)); }} />
                ))}
            </FilterGroup>
            <FilterGroup title="پایه" empty="اول یک درس را انتخاب کنید.">
                {grades.map((item) => (
                    <CheckRow key={String(item.id)} label={item.title} checked={selectedGrades.map(String).includes(String(item.id))} onToggle={() => { unlockSelection(); setSelectedGrades((prev) => toggleIn(prev, item.id)); }} />
                ))}
            </FilterGroup>
            <FilterGroup title="فصل" empty="بعد از درس، فصل‌ها اینجا می‌آیند.">
                {chapters.map((item) => (
                    <CheckRow key={String(item.id)} label={item.title} checked={selectedChapters.map(String).includes(String(item.id))} onToggle={() => { unlockSelection(); setSelectedChapters((prev) => toggleIn(prev, item.id)); }} />
                ))}
            </FilterGroup>
            <FilterGroup title="مبحث" empty="با انتخاب فصل، مبحث‌ها باز می‌شوند.">
                {mabhas.map((item) => (
                    <CheckRow key={String(item.id)} label={item.title} checked={selectedMabhas.map(String).includes(String(item.id))} onToggle={() => { unlockSelection(); setSelectedMabhas((prev) => toggleIn(prev, item.id)); }} />
                ))}
            </FilterGroup>
            <div>
                <p className="mb-2 text-[12px] font-black text-[var(--text-primary)]">سطح دشواری</p>
                <div className="grid grid-cols-3 gap-1.5">
                    {DIFFICULTIES.map((level) => {
                        const active = difficulties.includes(level);
                        return (
                            <button
                                key={level}
                                type="button"
                                onClick={() => { unlockSelection(); setDifficulties((prev) => (active ? prev.filter((item) => item !== level) : [...prev, level])); }}
                                className={`h-10 cursor-pointer rounded-xl px-2 text-[12px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${active ? difficultyTone(level) : 'bg-[var(--bg-app)] text-[var(--text-muted)]'}`}
                            >
                                {level}
                            </button>
                        );
                    })}
                </div>
            </div>
            {mode === 'auto' && (
                <div>
                    <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
                        <span>تعداد سوال خودکار</span>
                        <span className="text-[var(--accent)]">{fa(autoCount)}</span>
                    </div>
                    <input type="range" min={1} max={MAX_SELECTED} value={autoCount} onChange={(event) => { unlockSelection(); setAutoCount(Number(event.target.value)); }} className="w-full accent-[var(--accent)]" aria-label="تعداد سوال خودکار" />
                    <button type="button" onClick={() => { unlockSelection(); fetchQuestions(1); }} className="mt-2 h-10 w-full cursor-pointer rounded-xl bg-[var(--bg-app)] px-2 text-[12px] font-black text-[var(--accent)]">
                        نمونه‌گیری دوباره
                    </button>
                </div>
            )}
            <button
                type="button"
                onClick={() => {
                    unlockSelection();
                    setSelectedSubjects([]);
                    setSelectedGrades([]);
                    setSelectedChapters([]);
                    setSelectedMabhas([]);
                    setDifficulties([]);
                    setSearch('');
                }}
                className="h-10 cursor-pointer px-1 text-[12px] font-bold text-[var(--text-muted)]"
            >
                پاک کردن فیلترها
            </button>
        </div>
    );

    const setup = (layout: 'bar' | 'stack') => {
        const bar = layout === 'bar';
        return (
            <div className={bar ? 'flex flex-col gap-2' : 'space-y-3'}>
                <div className={bar ? 'flex flex-wrap items-center gap-2' : 'space-y-3'}>
                    <input
                        value={quizName}
                        onChange={(event) => setQuizName(event.target.value)}
                        placeholder="نام آزمون"
                        aria-label="نام آزمون"
                        className={`h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-3 text-[13px] outline-none focus:border-[var(--accent)] ${bar ? 'w-44' : 'w-full'}`}
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[10, 20, 30].map((minutes) => (
                            <button
                                key={minutes}
                                type="button"
                                onClick={() => { setIsCustomTime(false); setTime(minutes); }}
                                className={`h-10 cursor-pointer rounded-xl px-3 text-[12px] font-black ${!isCustomTime && time === minutes ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-element)] text-[var(--text-secondary)]'}`}
                            >
                                {fa(minutes)} دقیقه
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setIsCustomTime(true)}
                            className={`h-10 cursor-pointer rounded-xl px-3 text-[12px] font-black ${isCustomTime ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-element)] text-[var(--text-secondary)]'}`}
                        >
                            دلخواه
                        </button>
                        {isCustomTime && (
                            <input
                                type="number"
                                value={time || ''}
                                aria-label="زمان دلخواه به دقیقه"
                                onChange={(event) => setTime(parseInt(event.target.value, 10) || 0)}
                                className="h-10 w-16 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] text-center text-[12px]"
                            />
                        )}
                    </div>
                    <Switch
                        compact={bar}
                        on={visibility === 'public'}
                        label={visibility === 'public' ? 'آزمون عمومی' : 'آزمون شخصی'}
                        onClick={() => setVisibility((value) => (value === 'private' ? 'public' : 'private'))}
                    />
                    {visibility === 'public' && (
                        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-secondary)]">
                            <Users size={14} />
                            {[5, 10, 15].map((limit) => (
                                <button
                                    key={limit}
                                    type="button"
                                    onClick={() => setMemberLimit(limit)}
                                    className={`h-10 cursor-pointer rounded-xl px-2.5 ${memberLimit === limit ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-element)]'}`}
                                >
                                    {fa(limit)} نفر
                                </button>
                            ))}
                        </div>
                    )}
                    {bar && (
                        <button
                            type="button"
                            onClick={handleStartQuiz}
                            disabled={isCreating || selected.length === 0}
                            className="ms-auto inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="rotate-180" />}
                            {visibility === 'public' ? 'ساخت آزمون' : 'ساخت و شروع'}
                        </button>
                    )}
                </div>

                <div className={bar ? 'flex flex-wrap items-center gap-1.5' : 'rounded-2xl border border-[var(--border)] bg-[var(--bg-element)] p-3'}>
                    {!bar && <p className="mb-1 text-[12px] font-black">کد اشتراک و تاریخچه</p>}
                    <button type="button" disabled={saving} onClick={() => saveSelection(false)} className="h-10 cursor-pointer rounded-xl bg-[var(--accent)] px-3 text-[12px] font-black text-white disabled:opacity-60">
                        {saving ? 'در حال ذخیره' : 'ذخیره'}
                    </button>
                    <button type="button" disabled={saving} onClick={() => saveSelection(true)} className="h-10 cursor-pointer rounded-xl bg-[var(--bg-element)] px-3 text-[12px] font-black text-[var(--text-secondary)]">
                        کد تازه
                    </button>
                    {savedCode && (
                        <button type="button" onClick={() => copyCode(savedCode)} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-xl bg-[var(--bg-element)] px-2.5 text-[12px] font-black tracking-wider text-[var(--accent)]">
                            <Copy size={13} />
                            {savedCode}
                        </button>
                    )}
                    <input
                        value={loadInput}
                        onChange={(event) => setLoadInput(event.target.value.toUpperCase())}
                        placeholder="ورود کد"
                        aria-label="ورود کد"
                        className="h-10 w-28 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] px-3 text-[12px] tracking-wider"
                    />
                    <button type="button" onClick={() => loadByCode(loadInput)} className="h-10 cursor-pointer rounded-xl bg-[var(--text-primary)] px-3 text-[12px] font-black text-[var(--bg-card)]">
                        بارگذاری
                    </button>
                    {mySaves.length > 0 && (
                        <div className={`flex gap-1.5 ${bar ? 'max-w-full overflow-x-auto' : 'mt-2 w-full flex-col'}`}>
                            {mySaves.map((item) => (
                                <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => loadByCode(item.code)}
                                    className={`cursor-pointer text-right ${bar ? 'h-8 shrink-0 rounded-full bg-[var(--bg-element)] px-2.5 text-[11px] font-bold' : 'flex w-full items-center justify-between gap-2 rounded-xl bg-[var(--bg-card)] px-2.5 py-2 text-[12px] font-bold'}`}
                                >
                                    <span className="truncate">{item.title}</span>
                                    {bar ? <span className="ms-1 font-black text-[var(--accent)]">{item.code}</span> : <span className="shrink-0 font-black text-[var(--accent)]">{item.code} · {fa(item.count)}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {!bar && (
                    <button
                        type="button"
                        onClick={handleStartQuiz}
                        disabled={isCreating || selected.length === 0}
                        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="rotate-180" />}
                        {visibility === 'public' ? 'ساخت آزمون' : 'ساخت و شروع'}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="bank-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-app)]" dir="rtl">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 lg:px-4">
                {onBack && (
                    <button type="button" onClick={onBack} aria-label="بازگشت" className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-[var(--bg-element)] p-0 text-[var(--text-secondary)]">
                        <ChevronRight size={18} />
                    </button>
                )}
                <h2 className="min-w-0 flex-1 truncate text-[15px] font-black">بانک تست</h2>
                <span className="hidden text-[12px] font-bold text-[var(--text-muted)] sm:inline">{fa(selected.length)} انتخاب</span>
                <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-[12px] font-black lg:hidden">
                    <SlidersHorizontal size={14} />
                    فیلتر
                </button>
                <button type="button" onClick={() => setSetupOpen(true)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-[12px] font-black text-white lg:hidden">
                    <Clock3 size={14} />
                    آزمون
                </button>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 lg:block">
                    {renderFilters()}
                </aside>

                <section className="flex min-h-0 min-w-0 flex-col">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2 lg:px-4">
                        <div className="flex items-center gap-1 rounded-full bg-[var(--bg-element)] p-1">
                            <button type="button" onClick={() => setShowPicked(false)} className={`h-8 cursor-pointer rounded-full px-3 text-[12px] font-black ${!showPicked ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>همه</button>
                            <button type="button" onClick={() => setShowPicked(true)} className={`h-8 cursor-pointer rounded-full px-3 text-[12px] font-black ${showPicked ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>انتخاب‌شده · {fa(selected.length)}</button>
                        </div>
                        <div className="flex items-center gap-2">
                            {!showPicked && hasApplied && <span className="hidden text-[12px] font-bold text-[var(--text-muted)] sm:inline">{fa(total)} سوال</span>}
                            {mode === 'manual' && visibleQuestions.length > 0 && !showPicked && (
                                <button type="button" onClick={addVisible} className="h-8 cursor-pointer rounded-lg px-2 text-[12px] font-black text-[var(--accent)]">افزودن این صفحه</button>
                            )}
                            {selected.length > 0 && (
                                <button type="button" onClick={() => setSelected([])} aria-label="پاک کردن انتخاب" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg p-0 text-[var(--text-muted)] hover:text-[var(--error)]">
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-28 lg:px-5 lg:pb-5">
                        <div className="mx-auto flex w-full max-w-3xl flex-col">
                            {loading && (
                                <div className="flex min-h-[40vh] items-center justify-center">
                                    <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
                                </div>
                            )}

                            {!loading && !hasApplied && !showPicked && (
                                <EmptyState
                                    icon={Library}
                                    title="بانک هنوز خالی است"
                                    text="از فیلترها یک درس را انتخاب کن تا سوال‌ها صفحه‌به‌صفحه بیایند."
                                />
                            )}

                            {!loading && showPicked && selected.length === 0 && (
                                <EmptyState icon={BookOpen} title="هنوز سوالی برنداشتی" text="از فهرست سوال‌ها هر کدام را که می‌خواهی علامت بزن." />
                            )}

                            {!loading && hasApplied && !showPicked && questions.length === 0 && (
                                <EmptyState icon={Search} title="سوالی پیدا نشد" text="فیلتر یا عبارت جستجو را عوض کن." />
                            )}

                            {!loading && visibleQuestions.length > 0 && (
                                <div className="space-y-2.5">
                                    {visibleQuestions.map((question, index) => {
                                        const picked = selectedIds.has(question.id);
                                        const number = showPicked ? index + 1 : ((page - 1) * PAGE_SIZE) + index + 1;
                                        return (
                                            <article
                                                key={question.id}
                                                className={`rounded-2xl border bg-[var(--bg-card)] p-3 ${picked ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}
                                            >
                                                <div className="flex items-start gap-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleQuestion(question)}
                                                        aria-label={picked ? 'حذف از آزمون' : 'افزودن به آزمون'}
                                                        aria-pressed={picked}
                                                        className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border-2 p-0 transition-colors ${picked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--accent)]'}`}
                                                    >
                                                        {picked ? <Check size={16} strokeWidth={3} /> : <span className="text-[12px] font-black">{fa(number)}</span>}
                                                    </button>
                                                    <div className="min-w-0 flex-1 pt-0.5">
                                                        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)]">
                                                            {question.subject_title && <span>{question.subject_title}</span>}
                                                            {question.grade_title && <span>{question.grade_title}</span>}
                                                            <span className={`rounded-full px-1.5 py-0.5 ${difficultyTone(question.difficulty)}`}>{question.difficulty}</span>
                                                        </div>
                                                        <div className="text-[15px] font-semibold leading-7 text-[var(--text-primary)]">
                                                            <MathRenderer text={question.text} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {question.image && (
                                                    <img src={`${IMAGE_BASE}${question.image}`} alt="" className="mx-auto mt-2 max-h-36 rounded-xl border border-[var(--border)] bg-white object-contain" />
                                                )}
                                                {question.options && question.options.length > 0 && (
                                                    <div className="mt-2 grid grid-cols-1 gap-1.5 min-[520px]:grid-cols-2">
                                                        {question.options.map((option, optionIndex) => (
                                                            <div key={option.id} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-element)] px-2.5 py-1.5 text-[13px] leading-5 text-[var(--text-primary)]">
                                                                <span className="shrink-0 text-[11px] font-black text-[var(--text-muted)]">{fa(optionIndex + 1)}</span>
                                                                <span className="min-w-0">
                                                                    <MathRenderer text={option.text} inline />
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}

                            {!showPicked && mode === 'manual' && hasApplied && pageCount > 1 && (
                                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                                    <button type="button" disabled={page <= 1 || loading} onClick={() => fetchQuestions(page - 1)} aria-label="صفحه قبل" className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-[var(--bg-card)] p-0 disabled:opacity-40">
                                        <ChevronRight size={16} />
                                    </button>
                                    {pageNumbers.map((number) => (
                                        <button
                                            key={number}
                                            type="button"
                                            onClick={() => fetchQuestions(number)}
                                            className={`h-10 min-w-10 cursor-pointer rounded-xl px-2 text-[12px] font-black ${number === page ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'}`}
                                        >
                                            {fa(number)}
                                        </button>
                                    ))}
                                    <button type="button" disabled={page >= pageCount || loading} onClick={() => fetchQuestions(page + 1)} aria-label="صفحه بعد" className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-[var(--bg-card)] p-0 disabled:opacity-40">
                                        <ChevronLeft size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <footer className="hidden shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 lg:block">
                {setup('bar')}
            </footer>

            <Sheet open={filtersOpen} title="فیلتر سوالات" onClose={() => setFiltersOpen(false)}>{renderFilters()}</Sheet>
            <Sheet open={setupOpen} title="تنظیم آزمون" onClose={() => setSetupOpen(false)}>{setup('stack')}</Sheet>
        </div>
    );
}

function FilterGroup({
    title,
    empty,
    children,
}: {
    title: string;
    empty: string;
    children: React.ReactNode;
}) {
    const items = React.Children.toArray(children);
    return (
        <section>
            <p className="mb-1 text-[12px] font-black text-[var(--text-primary)]">{title}</p>
            {items.length === 0 ? (
                <p className="px-1 text-[11px] leading-5 text-[var(--text-muted)]">{empty}</p>
            ) : (
                <div className="space-y-0.5">{items}</div>
            )}
        </section>
    );
}

function EmptyState({
    icon: Icon,
    title,
    text,
}: {
    icon: LucideIcon;
    title: string;
    text: string;
}) {
    return (
        <div className="flex min-h-[46vh] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
                <Icon size={28} />
            </div>
            <h3 className="text-base font-black text-[var(--text-primary)]">{title}</h3>
            <p className="mt-1 max-w-xs text-[13px] leading-6 text-[var(--text-muted)]">{text}</p>
        </div>
    );
}

export default QuestionSelectorView;
