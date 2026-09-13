import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, ChevronLeft, Book, Clock, Activity, Users, Globe, ShieldCheck,
    CheckCircle2, List, Image as ImageIcon, Check,
    Target, PenTool, Zap, Edit3, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../../lib/authApi';
import { useUser } from '../../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { createLobby } from '../../socket/lobby.socket';
import { useSocket } from '../../socket/useSocket';
import { QuizCountdown } from '../../components/QuizCountdown';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuizSettings = {
    time: number;
    difficulty: number;
    visibility: 'public' | 'private';
    memberLimit: number;
    quizName: string;
    questionCounts: Record<string, number>;
};

interface NeedsViewProps {
    onStateChange?: (state: any) => void;
    onQuizStart?: (quizData?: any) => void;
    isCollapsed?: boolean;
    shareCode: string;
}

type FlowState = {
    lessons: string[];
    grades: string[];
    quizType: 'chapter' | 'mabhas' | null;
    chapters: string[];
    mabhas: string[];
    settings: QuizSettings;
};

// ─── Motion variants ──────────────────────────────────────────────────────────

const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? -20 : 20, opacity: 0, scale: 0.98 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? -20 : 20, opacity: 0, scale: 0.98 }),
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LESSON_IMAGES: Record<number, string> = {
    1: '/lordicons/6ea59a8a-30cb-4021-a420-b026d8870572.svg',
    2: '/lordicons/bc0f66dd-c736-4794-979b-f9d56bf4668c.svg',
    4: '/lordicons/122ef337-9a25-44f3-8a35-dc1fad7cb929.svg',
    3: '/lordicons/97596a33-68d4-4457-aaf2-fbf662f21a54.svg',
};
const DEFAULT_LESSON_ICON = '/lordicons/default-lesson.svg';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const getDisplayLabel = (item: any, fallbackId?: string | number) => {
    return (
        item?.title ||
        item?.name ||
        item?.label ||
        item?.fa_name ||
        item?.subject_name ||
        item?.grade_name ||
        item?.chapter_title ||
        item?.chapter_name ||
        item?.mabhas_title ||
        item?.mabhas_name ||
        item?.mabhas ||
        item?.chapter ||
        (fallbackId != null ? `مورد ${fallbackId}` : '')
    );
};

// Simplified lookups since fields are now provided natively by the updated backend queries
const getSubjectId = (item: any): string | null => {
    const sid = item?.subject_id ?? item?.subjectId;
    return sid != null ? String(sid) : null;
};

const getGradeId = (item: any): string | null => {
    const gid = item?.grade_id ?? item?.gradeId;
    return gid != null ? String(gid) : null;
};

const lookupCache = (cache: Record<string, any>, id: string | number) => cache[String(id)] || null;

const hasId = (ids: Array<string | number>, id: string | number) =>
    ids.some(value => String(value) === String(id));

/** Keep one card per entity id so a SQL join cannot render the same mabhas twice. */
const uniqueById = (items: any[]) => {
    const seen = new Map<string, any>();
    for (const item of items) {
        if (item == null || item.id == null) continue;
        const key = String(item.id);
        if (!seen.has(key)) seen.set(key, item);
    }
    return Array.from(seen.values());
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FilterTabs = ({ items, activeTab, setActiveTab, cache, uniqueId, emptyLabel }: any) => {
    if (items.length <= 1) return null;
    return (
        <div className="flex items-center gap-1.5 bg-[var(--bg-element)]/80 p-1 rounded-[12px] border border-[var(--border)]/50 w-full overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <button
                onClick={() => setActiveTab('all')}
                className={`relative flex-1 min-w-fit px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-[10px] transition-all duration-300 whitespace-nowrap ${
                    activeTab === 'all' ? 'text-white drop-shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50'
                }`}
            >
                {activeTab === 'all' && (
                    <motion.div layoutId={`tab-pill-${uniqueId}`} className="absolute inset-0 bg-[var(--accent)] rounded-[10px] shadow-sm shadow-[var(--accent)]/20" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10">{emptyLabel}</span>
            </button>

            {items.map((id: string | number) => {
                const item = cache[String(id)];
                const label = getDisplayLabel(item, id);

                return (
                    <button
                        key={id}
                        onClick={() => setActiveTab(String(id))}
                        className={`relative flex-1 min-w-fit px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-[10px] transition-all duration-300 whitespace-nowrap ${
                            activeTab === String(id) ? 'text-white drop-shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50'
                        }`}
                    >
                        {activeTab === String(id) && (
                            <motion.div layoutId={`tab-pill-${uniqueId}`} className="absolute inset-0 bg-[var(--accent)] rounded-[10px] shadow-sm shadow-[var(--accent)]/20" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                        )}
                        <span className="relative z-10">{label}</span>
                    </button>
                );
            })}
        </div>
    );
};


const SmoothSegmentedControl = ({ options, value, onChange, uniqueId }: any) => (
    <div className="flex bg-[var(--bg-element)]/80 dark:bg-[var(--bg-element)]/50 p-1 rounded-[12px] w-full relative border border-[var(--border)]/50">
        {options.map((opt: any) => {
            const isActive = value === opt.value;
            return (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-[10px] z-10 transition-all duration-300 ${
                        isActive ? 'text-white drop-shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50'
                    }`}
                >
                    {isActive && (
                        <motion.div
                            layoutId={`active-pill-${uniqueId}`}
                            className="absolute inset-0 bg-[var(--accent)] rounded-[10px] shadow-sm shadow-[var(--accent)]/20"
                            initial={false}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                        {opt.icon && <opt.icon size={14} strokeWidth={isActive ? 2.5 : 2} />}
                        {opt.label}
                    </span>
                </button>
            );
        })}
    </div>
);

const SettingRow = ({ icon: Icon, label, desc, control, children }: any) => (
    <div className="flex flex-col p-4 gap-3 border-b border-[var(--border)] last:border-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shrink-0">
                <Icon size={16} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
                <div className="text-[13px] font-bold text-[var(--text-primary)]">{label}</div>
                {desc && <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{desc}</div>}
            </div>
        </div>
        <div className="w-full mt-1">{control || children}</div>
    </div>
);

const IOSSwitch = ({ checked, onChange }: any) => (
    <div
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 shrink-0 ${checked ? 'bg-[var(--accent)]' : 'bg-gray-300 dark:bg-gray-700'}`}
    >
        <motion.div
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`bg-white w-4 h-4 rounded-full shadow-sm transform ${checked ? '-translate-x-[16px]' : 'translate-x-0'}`}
        />
    </div>
);

const ImageCard = ({ imageSrc, label, desc, onClick, active }: any) => (
    <div
        onClick={onClick}
        className={`group relative flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-card)] border transition-all duration-300 cursor-pointer overflow-hidden ${
            active ? 'border-[var(--accent)] shadow-sm shadow-[var(--accent)]/10 ring-1 ring-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--accent)]/50'
        }`}
    >
        <div className={`w-14 h-14 rounded-[12px] overflow-hidden shrink-0 relative transition-transform duration-300 ${active ? 'scale-105' : 'group-hover:scale-105'}`}>
            {imageSrc ? (
                <img src={imageSrc} alt={label} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-[var(--bg-element)] flex items-center justify-center text-[var(--text-muted)]">
                    <ImageIcon size={20} />
                </div>
            )}
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[12px]" />
        </div>
        <div className="flex-1 min-w-0 text-right">
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{label}</h3>
            {desc && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{desc}</p>}
        </div>
    </div>
);

const SwitchCard = ({ icon: Icon, label, desc, checked, onToggle }: any) => (
    <div
        onClick={onToggle}
        className={`group flex items-center gap-3 p-4 rounded-2xl bg-[var(--bg-card)] border transition-all duration-300 cursor-pointer ${
            checked ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] hover:border-[var(--accent)]/50'
        }`}
    >
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 ${
            checked ? 'bg-[var(--accent)] text-white scale-105' : 'bg-[var(--bg-element)] text-[var(--text-muted)] group-hover:text-[var(--accent)]'
        }`}>
            <Icon size={16} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0 text-right">
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{label}</h3>
            {desc && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{desc}</p>}
        </div>
        <IOSSwitch checked={checked} onChange={onToggle} />
    </div>
);

const SkeletonCard = () => (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] animate-pulse">
        <div className="w-14 h-14 rounded-[12px] bg-[var(--bg-element)] shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-3 bg-[var(--bg-element)] rounded-md w-1/2" />
            <div className="h-2.5 bg-[var(--bg-element)] rounded-md w-1/3" />
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const NeedsView = ({ isCollapsed, onStateChange, shareCode, onQuizStart }: NeedsViewProps) => {
    const [step, setStep] = useState(1);
    const [direction, setDirection] = useState(1);

    const [dataLoading, setDataLoading] = useState(true);
    const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
    const [currentItems, setCurrentItems] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [subjectsCache, setSubjectsCache] = useState<Record<string, any>>({});
    const [gradesCache, setGradesCache] = useState<Record<string, any>>({});
    const [chaptersCache, setChaptersCache] = useState<Record<string, any>>({});
    const [mabhasCache, setMabhasCache] = useState<Record<string, any>>({});

    const [showStartCountdown, setShowStartCountdown] = useState(false);
    const [createdPrivateQuizId, setCreatedPrivateQuizId] = useState<string | null>(null);
    const [isCustomTime, setIsCustomTime] = useState(false);

    // Tab States for filtering List (Chapters & Mabahes)
    const [activeGradeTab, setActiveGradeTab] = useState<string>('all');
    const [activeSubjectTab, setActiveSubjectTab] = useState<string>('all');

    const [flowData, setFlowData] = useState<FlowState>({
        lessons: [], grades: [], quizType: null, chapters: [], mabhas: [],
        settings: { time: 30, difficulty: 2, visibility: 'private', memberLimit: 10, quizName: '', questionCounts: {} },
    });

    const navigate = useNavigate();
    const { socket, connect } = useSocket();

    // ─── Data fetching ────────────────────────────────────────────────────────

    const fetchStepData = async () => {
        setDataLoading(true);
        setError(null);
        try {
            let formattedItems: any[] = [];

            if (step === 1) {
                const res = await flowApi.dispatch('get_subjects');
                const raw = res.subjects || res.data || [];
                formattedItems = uniqueById(raw.map((s: any) => ({
                    ...s,
                    imageSrc: LESSON_IMAGES[s.id] || DEFAULT_LESSON_ICON,
                    // subtitle: s.question_count ? `${s.question_count} سوال` : undefined,
                })));

                setSubjectsCache(prev => {
                    const next = { ...prev };
                    formattedItems.forEach((item: any) => { next[String(item.id)] = item; });
                    return next;
                });
            } else if (step === 2) {
                const res = await flowApi.dispatch('get_grades_by_subjects_multi', { subjects: flowData.lessons });
                const raw = res.grades || res.data || [];
                formattedItems = uniqueById(raw.map((g: any) => ({
                    ...g,
                    // desc: g.question_count ? `${g.question_count} سوال` : undefined
                })));

                setGradesCache(prev => {
                    const next = { ...prev };
                    formattedItems.forEach((item: any) => { next[String(item.id)] = item; });
                    return next;
                });
            } else if (step === 4) {
                const res = await flowApi.dispatch('get_chapters_by_subjects_multi', {
                    subjects: flowData.lessons,
                    grades: flowData.grades
                });
                const raw = res.chapters || res.data || [];
                formattedItems = uniqueById(raw.map((c: any) => ({
                    ...c,
                    // desc: c.question_count ? `${c.question_count} سوال` : undefined
                })));

                setChaptersCache(prev => {
                    const next = { ...prev };
                    formattedItems.forEach((item: any) => { next[String(item.id)] = item; });
                    return next;
                });
            } else if (step === 5) {
                const res = await flowApi.dispatch('get_mabahes_by_chapters_multi', {
                    chapters: flowData.chapters,
                    grades: flowData.grades,
                });
                const raw = res.mabahes || res.data || [];
                formattedItems = uniqueById(raw.map((m: any) => ({
                    ...m,
                    // desc: m.question_count ? `${m.question_count} سوال` : undefined
                })));

                setMabhasCache(prev => {
                    const next = { ...prev };
                    formattedItems.forEach((item: any) => { next[String(item.id)] = item; });
                    return next;
                });
            }

            setCurrentItems(formattedItems);
        } catch (err) {
            const msg = 'خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.';
            setError(msg);
            toast.error(msg);
        } finally {
            setDataLoading(false);
        }
    };

    // Serialize arrays so references can be compared accurately inside effect dependencies
    const serializedLessons = JSON.stringify(flowData.lessons);
    const serializedGrades = JSON.stringify(flowData.grades);
    const serializedChapters = JSON.stringify(flowData.chapters);

    // Decoupled Effects: Step 1 (Subjects)
    useEffect(() => {
        if (step === 1) {
            fetchStepData();
        }
    }, [step]);

    // Decoupled Effects: Step 2 (Grades only fetch when step 2 active OR lessons change)
    useEffect(() => {
        if (step === 2) {
            fetchStepData();
        }
    }, [step, serializedLessons]);

    // Decoupled Effects: Step 4 (Chapters only fetch when step 4 active OR lessons/grades change)
    useEffect(() => {
        if (step === 4) {
            fetchStepData();
        }
    }, [step, serializedLessons, serializedGrades]);

    // Decoupled Effects: Step 5 (Mabahes only fetch when step 5 active OR chapters change)
    useEffect(() => {
        if (step === 5) {
            fetchStepData();
        }
    }, [step, serializedChapters]);

    useEffect(() => { if (onStateChange) onStateChange(flowData); }, [flowData, onStateChange]);

    // Cleanup active tabs if selected parents filter drops them out
    useEffect(() => {
        if (activeGradeTab !== 'all' && !flowData.grades.map(String).includes(activeGradeTab)) {
            setActiveGradeTab('all');
        }
    }, [flowData.grades, activeGradeTab]);

    useEffect(() => {
        if (activeSubjectTab !== 'all' && !flowData.lessons.map(String).includes(activeSubjectTab)) {
            setActiveSubjectTab('all');
        }
    }, [flowData.lessons, activeSubjectTab]);

    // ─── 50-question budget: set defaults when reaching step 7 ───────────────
    useEffect(() => {
        if (step !== 7) return;
        const TOTAL_BUDGET = 50;
        const selectedItems = flowData.quizType === 'chapter' ? flowData.chapters : flowData.mabhas;
        if (selectedItems.length === 0) return;

        const perItemBudget = Math.floor(TOTAL_BUDGET / selectedItems.length);
        let hasChanges = false;
        const newCounts = { ...flowData.settings.questionCounts };

        selectedItems.forEach(id => {
            if (newCounts[id] === undefined) {
                const cache = flowData.quizType === 'chapter' ? chaptersCache : mabhasCache;
                const item = lookupCache(cache, id) || {};
                const avail = item.question_count || 30;
                const cap = Math.min(perItemBudget, avail);
                newCounts[id] = Math.min(10, cap);
                hasChanges = true;
            }
        });

        if (hasChanges) setFlowData(prev => ({ ...prev, settings: { ...prev.settings, questionCounts: newCounts } }));
    }, [
        step,
        flowData.chapters,
        flowData.mabhas,
        flowData.quizType
    ]);

    const getCachedItem = (id: string | number, cache: Record<string, any>) => lookupCache(cache, id);

    // ─── Filter logic for Steps 4 & 5 ─────────────────────────────────────────

    const filteredStepItems = useMemo(() => {
        if (step !== 4 && step !== 5) return [];

        let items = currentItems;

        if (activeGradeTab !== 'all' && flowData.grades.length > 1) {
            items = items.filter(item => getGradeId(item) === String(activeGradeTab));
        }

        if (activeSubjectTab !== 'all' && flowData.lessons.length > 1) {
            items = items.filter(item => getSubjectId(item) === String(activeSubjectTab));
        }

        return items;
    }, [
        step,
        currentItems,
        activeGradeTab,
        activeSubjectTab,
        flowData.grades.length,
        flowData.lessons.length
    ]);

    // ─── Navigation ───────────────────────────────────────────────────────────

    const scrollToId = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const changeStep = (newStep: number, dir: number) => {
        setDirection(dir);
        setStep(newStep);
        setTimeout(() => scrollToId('Title'), 100);
    };

    const handleNext = () => {
        if (step === 4 && flowData.quizType === 'chapter') changeStep(6, 1);
        else changeStep(step + 1, 1);
    };

    const handleBack = () => {
        if (step === 6 && flowData.quizType === 'chapter') changeStep(4, -1);
        else changeStep(step - 1, -1);
    };

    const isNextDisabled = () => {
        if (step === 1) return flowData.lessons.length === 0;
        if (step === 2) return flowData.grades.length === 0;
        if (step === 3) return !flowData.quizType;
        if (step === 4) return flowData.chapters.length === 0;
        if (step === 5) return flowData.mabhas.length === 0;
        if (step === 6) return !flowData.settings.time || flowData.settings.time <= 0;
        return false;
    };

    // ─── State mutators ───────────────────────────────────────────────────────

    const toggleLesson = (item: any) => {
        setFlowData(prev => {
            const exists = hasId(prev.lessons, item.id);

            return {
                ...prev,
                lessons: exists
                    ? prev.lessons.filter(id => String(id) !== String(item.id))
                    : [...prev.lessons, item.id],
                grades: [],
                chapters: [],
                mabhas: [],
            };
        });
    };


    const toggleArrayItem = (
        key: 'grades' | 'chapters' | 'mabhas',
        item: any
    ) => {
        setFlowData(prev => {
            const arr = prev[key];
            const exists = hasId(arr, item.id);

            const next = {
                ...prev,
                [key]: exists
                    ? arr.filter(id => String(id) !== String(item.id))
                    : [...arr, item.id],
            };

            if (key === 'grades') {
                next.chapters = [];
                next.mabhas = [];
            }

            if (key === 'chapters') {
                next.mabhas = [];
            }

            return next;
        });
    };


    const updateFlow = (key: keyof FlowState, value: any) => setFlowData(prev => ({ ...prev, [key]: value }));
    const updateSetting = (key: keyof QuizSettings, value: any) => setFlowData(prev => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

    // ─── Quiz creation ────────────────────────────────────────────────────────

    const handleStartQuiz = async () => {
        setIsCreatingQuiz(true);
        const loadingToastId = toast.loading('درحال ساخت آزمون...');
        try {
            const nameMap = (ids: string[], cache: Record<string, any>) => ids.reduce((acc, id) => {
                const match = getCachedItem(id, cache);

                return {
                    ...acc,
                    [id]: getDisplayLabel(match, id),
                };
            }, {});


            const payload = {
                action: 'create_quiz',
                lessons: flowData.lessons, grades: flowData.grades,
                quizType: flowData.quizType, chapters: flowData.chapters, mabhas: flowData.mabhas,
                settings: flowData.settings, shareCode,
                lessonNames: nameMap(flowData.lessons, subjectsCache),
                gradeNames: nameMap(flowData.grades, gradesCache),
                chapterNames: nameMap(flowData.chapters, chaptersCache),
                mabhasNames: nameMap(flowData.mabhas, mabhasCache),
            };

            const res = await flowApi.dispatch('create_quiz', payload);
            await new Promise(r => setTimeout(r, 800));

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

            if (flowData.settings.visibility === 'private') {
                toast.success('آزمون با موفقیت ساخته شد. تا لحظاتی دیگر شروع می‌شود...', { id: loadingToastId });
                setCreatedPrivateQuizId(String(createdQuizId));
                setShowStartCountdown(true);
                return;
            }

            toast.loading('در حال ساخت لابی...', { id: loadingToastId });
            let activeSocket = socket || connect();
            if (!activeSocket) {
                toast.error('اتصال لحظه‌ای در دسترس نیست. لطفاً دوباره وارد شوید.', { id: loadingToastId });
                return;
            }
            if (!activeSocket.connected) await waitForSocketConnection(activeSocket);

            const lobby = await createLobby(activeSocket, {
                quizId: String(createdQuizId),
                code: String(shareCode),
                maxMembers: flowData.settings.memberLimit,
            });

            toast.success('آزمون و لابی با موفقیت ساخته شدند', { id: loadingToastId });
            navigate(`/lobby/${lobby.code}`);
        } catch (error: any) {
            toast.error(error?.message || 'خطا در ارتباط با سرور', { id: loadingToastId });
        } finally {
            setIsCreatingQuiz(false);
        }
    };

    if (showStartCountdown && createdPrivateQuizId) {
        return <QuizCountdown durationMs={3000} onComplete={() => navigate(`/quiz/${createdPrivateQuizId}`)} />;
    }

    // ─── Render functions ─────────────────────────────────────────────────────

    const renderListStep = (listKey: 'chapters' | 'mabhas', icon: any) => {
        if (dataLoading) {
            return (
                <div className="space-y-5 animate-pulse">
                    <div className="flex flex-col gap-3">
                        <div className="h-8 w-full bg-[var(--bg-element)]/80 rounded-[12px]" />
                        <div className="h-8 w-full bg-[var(--bg-element)]/80 rounded-[12px]" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                    </div>
                </div>
            );
        }

        if (currentItems.length === 0) {
            return <div className="text-center text-[var(--text-muted)] py-10">موردی یافت نشد.</div>;
        }

        const selectedIds = flowData[listKey];
        const filteredIds = filteredStepItems.map(i => i.id);
        const selectedFilteredCount = filteredIds.filter(id => hasId(selectedIds, id)).length;
        const allFilteredSelected = selectedFilteredCount === filteredIds.length && filteredIds.length > 0;

        const handleSelectAllFiltered = () => {
            if (allFilteredSelected) {
                setFlowData(prev => ({
                    ...prev,
                    [listKey]: prev[listKey].filter((id: string) => !hasId(filteredIds, id)),
                }));
            } else {
                setFlowData(prev => {
                    const nextIds = prev[listKey].filter((id: string) => !hasId(filteredIds, id));
                    filteredIds.forEach(id => nextIds.push(id));
                    return {
                        ...prev,
                        [listKey]: nextIds,
                    };
                });

            }
        };

        return (
            <div className="space-y-5">
                <div className="flex flex-col gap-3">
                    <FilterTabs
                        items={flowData.grades}
                        activeTab={activeGradeTab}
                        setActiveTab={setActiveGradeTab}
                        cache={gradesCache}
                        uniqueId={`grades-${step}`}
                        emptyLabel="همه پایه‌ها"
                    />

                    <FilterTabs
                        items={flowData.lessons}
                        activeTab={activeSubjectTab}
                        setActiveTab={setActiveSubjectTab}
                        cache={subjectsCache}
                        uniqueId={`subjects-${step}`}
                        emptyLabel="همه درس‌ها"
                    />

                </div>

                {filteredStepItems.length > 0 && (
                    <div className="flex justify-between items-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3 shadow-sm">
                        <span className="text-[12px] font-bold text-[var(--text-primary)] px-2">
                            {filteredStepItems.length} مورد یافت شد
                        </span>
                        <button
                            onClick={handleSelectAllFiltered}
                            className={`text-[11px] font-semibold px-4 py-1.5 rounded-lg border transition-colors ${
                                allFilteredSelected
                                    ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                                    : 'bg-[var(--bg-element)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]'
                            }`}
                        >
                            {allFilteredSelected ? 'لغو انتخاب همه' : 'انتخاب همه'}
                        </button>
                    </div>
                )}

                {filteredStepItems.length === 0 ? (
                    <div className="text-center text-[var(--text-muted)] py-10 text-sm">موردی برای این فیلتر یافت نشد.</div>
                ) : (
                    // Added framer motion layout animation wrapper for smooth transitions
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <AnimatePresence mode="popLayout">
                            {filteredStepItems.map(item => (
                                <motion.div
                                    key={String(item.id)}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                >
                                    <SwitchCard
                                        icon={icon}
                                        label={getDisplayLabel(item, item.id)}
                                        desc={item.desc}
                                        checked={hasId(selectedIds, item.id)}
                                        onToggle={() => toggleArrayItem(listKey, item)}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        );
    };

    const stepTitles = ['انتخاب درس‌ها', 'انتخاب پایه‌ها', 'نوع آزمون', 'انتخاب فصل', 'انتخاب مبحث', 'تنظیمات آزمون', 'تایید و شروع آزمون'];

    const renderStepContent = () => {
        if (error) return <div className="text-center text-red-500 py-10 font-bold">{error}</div>;

        switch (step) {
            // ── Step 1: Subjects ─────────────────────────────────────────────
            case 1:
                if (dataLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>;
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentItems.map((lesson) => (
                            <div key={lesson.id} className="relative">
                                <ImageCard
                                    imageSrc={lesson.imageSrc}
                                    label={lesson.name || lesson.title}
                                    desc={lesson.desc || lesson.subtitle}
                                    active={hasId(flowData.lessons, lesson.id)}
                                    onClick={() => toggleLesson(lesson)}
                                />
                                {hasId(flowData.lessons, lesson.id) && (
                                    <div className="absolute top-2 left-2 bg-[var(--accent)] text-white p-1 rounded-full shadow-sm z-10">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );

            // ── Step 2: Grades ───────────────────────────────────────────────
            case 2:
                if (dataLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>;
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentItems.map((grade) => (
                            <SwitchCard
                                key={grade.id}
                                icon={Layers}
                                label={grade.title || grade.name}
                                desc={grade.desc}
                                checked={hasId(flowData.grades, grade.id)}
                                onToggle={() => toggleArrayItem('grades', grade)}
                            />
                        ))}
                    </div>
                );

            // ── Step 3: Quiz type ────────────────────────────────────────────
            case 3:
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SwitchCard icon={Book} label="بر اساس فصل" desc="آزمون جامع از کل فصول انتخاب شده" checked={flowData.quizType === 'chapter'} onToggle={() => updateFlow('quizType', 'chapter')} />
                        <SwitchCard icon={Target} label="بر اساس مبحث" desc="آزمون دقیق و متمرکز از مباحث خاص" checked={flowData.quizType === 'mabhas'} onToggle={() => updateFlow('quizType', 'mabhas')} />
                    </div>
                );

            // ── Step 4: Chapters — grade and subject tabs ────────────────────
            case 4:
                return renderListStep('chapters', Book);

            // ── Step 5: Mabhas — grade and subject tabs ──────────────────────
            case 5:
                return renderListStep('mabhas', List);

            // ── Step 6: Settings ─────────────────────────────────────────────
            case 6:
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                        {/* Time & Difficulty block */}
                        <div className="bg-[var(--bg-card)] rounded-[16px] overflow-hidden border border-[var(--border)] shadow-sm">
                            <SettingRow icon={Clock} label="زمان آزمون" desc="مدت زمان کل آزمون را مشخص کنید.">
                                <SmoothSegmentedControl
                                    uniqueId="time"
                                    options={[
                                        { label: '۱۰ دقیقه', value: 10 },
                                        { label: '۲۰ دقیقه', value: 20 },
                                        { label: '۳۰ دقیقه', value: 30 },
                                        { label: 'سفارشی', value: 'custom', icon: Edit3 },
                                    ]}
                                    value={isCustomTime ? 'custom' : flowData.settings.time}
                                    onChange={(v: any) => {
                                        if (v === 'custom') { setIsCustomTime(true); updateSetting('time', 0); }
                                        else { setIsCustomTime(false); updateSetting('time', v); }
                                    }}
                                />
                                <AnimatePresence>
                                    {isCustomTime && (
                                        <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: '12px' }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="relative">
                                            <input
                                                type="number" placeholder="زمان را به دقیقه وارد کنید"
                                                value={flowData.settings.time || ''}
                                                onChange={(e) => updateSetting('time', parseInt(e.target.value))}
                                                className="w-full bg-[var(--bg-element)] border border-[var(--border)] rounded-[10px] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[12px] text-center"
                                            />
                                            <div className="absolute top-1/2 -translate-y-1/2 right-3 text-xs text-[var(--text-muted)]">دقیقه</div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </SettingRow>
                            <SettingRow
                                icon={Activity} label="سطح دشواری" desc="روی الگوریتم انتخاب سوالات تاثیر مستقیم دارد."
                                control={<SmoothSegmentedControl uniqueId="difficulty" options={[{ label: 'آسان', value: 1 }, { label: 'متوسط', value: 2 }, { label: 'سخت', value: 3 }]} value={flowData.settings.difficulty} onChange={(v: any) => updateSetting('difficulty', v)} />}
                            />
                        </div>

                        {/* Privacy & Member Capacity block */}
                        <div className="bg-[var(--bg-card)] rounded-[16px] overflow-hidden border border-[var(--border)] shadow-sm">
                            <SettingRow
                                icon={flowData.settings.visibility === 'public' ? Globe : ShieldCheck}
                                label="حریم خصوصی آزمون"
                                desc={flowData.settings.visibility === 'public'
                                    ? "دیگران می‌توانند از طریق کد دعوت وارد لابی شوند و با شما رقابت کنند."
                                    : "فقط شما این آزمون را می‌بینید. بدون لابی، مستقیم وارد آزمون می‌شوید."
                                }
                            >
                                <SmoothSegmentedControl
                                    uniqueId="visibility"
                                    options={[
                                        { label: 'شخصی', value: 'private', icon: ShieldCheck },
                                        { label: 'عمومی', value: 'public', icon: Users },
                                    ]}
                                    value={flowData.settings.visibility}
                                    onChange={(v: any) => updateSetting('visibility', v)}
                                />
                            </SettingRow>

                            <AnimatePresence initial={false}>
                                {flowData.settings.visibility === 'public' && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <SettingRow
                                            icon={Users}
                                            label="ظرفیت شرکت‌کنندگان"
                                            desc="حداکثر تعداد مجاز برای شرکت در این لابی."
                                        >
                                            <SmoothSegmentedControl
                                                uniqueId="memberLimit"
                                                value={String(flowData.settings.memberLimit ?? 10)}
                                                onChange={(v: any) => updateSetting('memberLimit', Number(v))}
                                                options={[{ label: '۵ نفر', value: '5' }, { label: '۱۰ نفر', value: '10' }, { label: '۱۵ نفر', value: '15' }]}
                                            />
                                        </SettingRow>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                );

            // ── Step 7: Review & confirm ─────────────────────────────────────
            case 7: {
                const TOTAL_BUDGET = 50;


                const selectedLessonsList = flowData.lessons.map(id => getCachedItem(id, subjectsCache)).filter(Boolean);
                const selectedGradesList = flowData.grades.map(id => getCachedItem(id, gradesCache)).filter(Boolean);
                const selectedChaptersList = flowData.chapters.map(id => getCachedItem(id, chaptersCache)).filter(Boolean);
                const selectedMabhasList = flowData.mabhas.map(id => getCachedItem(id, mabhasCache)).filter(Boolean);
                const selectedItems = flowData.quizType === 'chapter' ? selectedChaptersList : selectedMabhasList;

                const perItemBudget = selectedItems.length > 0 ? Math.floor(TOTAL_BUDGET / selectedItems.length) : TOTAL_BUDGET;

                const totalQuestions = selectedItems.reduce((acc: number, item: any) => {
                    return acc + (flowData.settings.questionCounts[item.id] || Math.min(10, Math.min(perItemBudget, item.question_count || 30)));
                }, 0);

                const budgetRemaining = TOTAL_BUDGET - totalQuestions;
                const budgetOver = budgetRemaining < 0;

                return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 items-start">
                        <div className="lg:col-span-7 space-y-5">
                            {/* Quiz name */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[16px] p-4 shadow-sm">
                                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] mb-3">
                                    <PenTool size={16} className="text-[var(--accent)]" />نام آزمون (اختیاری)
                                </label>
                                <input
                                    type="text" placeholder="مثلاً: تمرین جامع زیست..."
                                    value={flowData.settings.quizName}
                                    onChange={(e) => updateSetting('quizName', e.target.value)}
                                    className="w-full bg-[var(--bg-element)] border border-[var(--border)] rounded-[10px] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[12px]"
                                />
                            </div>

                            {/* Question distribution */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[16px] p-4 shadow-sm">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                                        <Target size={16} className="text-[var(--accent)]" />
                                        توزیع تعداد سوالات
                                    </div>
                                    <div className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                                        budgetOver
                                            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                                            : totalQuestions === TOTAL_BUDGET
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-[var(--bg-element)] text-[var(--text-muted)]'
                                    }`}>
                                        {totalQuestions} / {TOTAL_BUDGET} سوال
                                    </div>
                                </div>

                                {/* Helper message */}
                                <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-[var(--bg-element)]/60 border border-[var(--border)]/60">
                                    <Zap size={13} className="text-[var(--accent)] shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                        حداکثر <span className="font-bold text-[var(--text-primary)]">{TOTAL_BUDGET} سوال</span> در کل آزمون. با {selectedItems.length} بخش انتخابی، سهم هر بخش حداکثر{' '}
                                        <span className="font-bold text-[var(--text-primary)]">{perItemBudget} سوال</span> است.
                                        {budgetOver && (
                                            <span className="text-rose-500 font-bold"> مجموع سوالات از ۵۰ بیشتر شده، لطفاً تنظیم کنید.</span>
                                        )}
                                    </p>
                                </div>

                                {/* Budget bar */}
                                <div className="h-1.5 rounded-full bg-[var(--border)] mb-5 overflow-hidden">
                                    <motion.div
                                        className={`h-full rounded-full transition-colors ${budgetOver ? 'bg-rose-500' : 'bg-[var(--accent)]'}`}
                                        animate={{ width: `${Math.min(100, (totalQuestions / TOTAL_BUDGET) * 100)}%` }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                    />
                                </div>

                                {/* Per-item sliders */}
                                <div className="grid grid-cols-1 gap-3">
                                    {selectedItems.map((item: any) => {
                                        const avail = item.question_count || 30;
                                        const sliderMax = Math.min(perItemBudget, avail);
                                        const current = flowData.settings.questionCounts[item.id] ?? Math.min(10, sliderMax);

                                        return (
                                            <div key={item.id} className="bg-[var(--bg-element)]/40 px-4 py-3 rounded-[14px] border border-[var(--border)]/50">
                                                <div className="flex justify-between items-center mb-2.5">
                                                    <span className="text-[12px] font-bold text-[var(--text-primary)] truncate max-w-[75%]">
                                                        {item.title || item.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {avail < perItemBudget && (
                                                            <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-element)] px-1.5 py-0.5 rounded">
                                                                موجود: {avail}
                                                            </span>
                                                        )}
                                                        <span className="bg-[var(--accent)] text-white px-2 py-0.5 rounded-lg text-xs font-bold shadow-sm shadow-[var(--accent)]/30 min-w-[28px] text-center">
                                                            {current}
                                                        </span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max={sliderMax}
                                                    value={Math.min(current, sliderMax)}
                                                    onChange={(e) => updateSetting('questionCounts', {
                                                        ...flowData.settings.questionCounts,
                                                        [item.id]: parseInt(e.target.value),
                                                    })}
                                                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                                />
                                                <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-1">
                                                    <span>۱</span>
                                                    <span>{sliderMax}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Summary sidebar */}
                        <div className="lg:col-span-5 lg:sticky lg:top-6 self-start space-y-5">
                            <div className="bg-[var(--bg-card)] rounded-[16px] border border-[var(--border)] shadow-sm">
                                <div className="bg-[var(--bg-element)]/50 px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={16} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-bold text-sm text-[var(--text-primary)]">خلاصه آزمون</h3>
                                </div>
                                <div className="p-4 flex flex-col gap-5">
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        {[
                                            { icon: Clock, label: 'زمان', value: `${flowData.settings.time} دقیقه` },
                                            { icon: Activity, label: 'سطح', value: ['آسان', 'متوسط', 'سخت'][flowData.settings.difficulty - 1] },
                                            { icon: flowData.settings.visibility === 'public' ? Users : ShieldCheck, label: 'نوع', value: flowData.settings.visibility === 'public' ? 'عمومی' : 'شخصی' },
                                        ].map(({ icon: Icon, label, value }, i) => (
                                            <div key={i} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-[var(--bg-element)]/60 border border-[var(--border)]/50">
                                                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                                    <Icon size={14} className="text-[var(--accent)]" strokeWidth={2} />{label}
                                                </div>
                                                <div className="font-bold text-[13px] text-[var(--text-primary)]">{value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-4 text-sm">
                                        <div className="flex flex-col gap-2">
                                            <h4 className="font-semibold text-xs text-[var(--text-primary)] border-b border-[var(--border)] pb-2">دروس انتخابی:</h4>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {selectedLessonsList.map(l => <span key={l.id} className="text-[11px] font-medium bg-[var(--bg-element)] px-2 py-1 rounded-md">{l.name || l.title}</span>)}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <h4 className="font-semibold text-xs text-[var(--text-primary)] border-b border-[var(--border)] pb-2">پایه‌های انتخابی:</h4>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {selectedGradesList.map(g => <span key={g.id} className="text-[11px] font-medium bg-[var(--bg-element)] px-2 py-1 rounded-md">{g.name || g.title}</span>)}
                                            </div>
                                        </div>
                                        {selectedChaptersList.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h4 className="font-semibold text-xs text-[var(--text-primary)] border-b border-[var(--border)] pb-2">فصول انتخابی:</h4>
                                                <ul className="space-y-1.5 pt-1 list-disc list-inside text-[var(--text-secondary)]">
                                                    {selectedChaptersList.map(c => <li key={c.id} className="text-[11px]">{c.title || c.name}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {selectedMabhasList.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h4 className="font-semibold text-xs text-[var(--text-primary)] border-b border-[var(--border)] pb-2">مباحث انتخابی:</h4>
                                                <ul className="space-y-1.5 pt-1 list-disc list-inside text-[var(--text-secondary)]">
                                                    {selectedMabhasList.map(m => <li key={m.id} className="text-[11px]">{m.title || m.name}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleStartQuiz}
                                        disabled={isNextDisabled() || isCreatingQuiz || budgetOver}
                                        className={`w-full py-3.5 rounded-[12px] text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 mt-auto ${
                                            isNextDisabled() || isCreatingQuiz || budgetOver
                                                ? 'bg-[var(--bg-element)] text-[var(--text-muted)] cursor-not-allowed'
                                                : 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 hover:-translate-y-0.5 active:scale-95'
                                        }`}
                                    >
                                        {isCreatingQuiz
                                            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <><span>{flowData.settings.visibility === 'public' ? 'ساخت آزمون' : 'ساخت و شروع آزمون'}</span><Play size={18} className="rotate-180" /></>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        }
    };

    // ─── Shell ────────────────────────────────────────────────────────────────

    return (
        <div className="w-full h-full bg-background overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-28 lg:pb-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header row */}
                <div className="pt-6 pb-6 flex items-start justify-between" id="Title">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">{stepTitles[step - 1]}</h3>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5, 6, 7].map(s => (
                                    <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-5 bg-[var(--accent)]' : s < step ? 'w-2 bg-[var(--accent)]/40' : 'w-2 bg-[var(--bg-element)]'}`} />
                                ))}
                            </div>
                            <span className="text-[var(--text-muted)] text-[11px] font-medium mr-2">مرحله {step} از ۷</span>
                        </div>
                    </div>

                    {/* Desktop nav - Hidden on smaller screens up to lg (1024px) */}
                    <div className="hidden lg:flex items-center gap-3">
                        {!dataLoading && step < 7 && (
                            <button onClick={handleNext} disabled={isNextDisabled()} className={`px-5 p-2 rounded-[12px] text-[13px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 min-w-[100px] ${isNextDisabled() ? 'bg-[var(--bg-element)] text-[var(--text-muted)] cursor-not-allowed' : 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20 active:scale-95 hover:bg-[var(--accent)]/90'}`}>
                                ادامه
                            </button>
                        )}
                        {step > 1 && (
                            <button onClick={handleBack} className="p-2 rounded-[12px] bg-[var(--bg-element)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors active:scale-95">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                    </div>

                    {/* Mobile back - Replaces standard navigation bar for mobile setups */}
                    {step > 1 && (
                        <button onClick={handleBack} className="lg:hidden p-2 rounded-[12px] bg-[var(--bg-element)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors active:scale-95">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                </div>

                {/* Animated step content */}
                <div className="relative will-change-transform">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={step + (dataLoading ? '-loading' : '')}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            className="w-full"
                        >
                            {renderStepContent()}
                        </motion.div>
                    </AnimatePresence>

                    {/* Mobile continue button */}
                    {!dataLoading && step < 7 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 pt-5 border-t border-[var(--border)] flex lg:hidden justify-center">
                            <button
                                onClick={handleNext}
                                disabled={isNextDisabled()}
                                className={`px-8 py-3 w-full max-w-xs rounded-[12px] text-[13px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${isNextDisabled() ? 'bg-[var(--bg-element)] text-[var(--text-muted)] cursor-not-allowed' : 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 active:scale-95'}`}
                            >
                                ادامه
                            </button>
                        </motion.div>
                    )}
                </div>

            </div>
        </div>
    );
};