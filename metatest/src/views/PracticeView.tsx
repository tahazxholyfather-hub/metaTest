// src/views/PracticeView.tsx
import { flowApi } from '../lib/authApi';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTour, type TourStep } from '../context/TourContext';
import {
    BookOpen,
    GraduationCap,
    Layers,
    ListFilter,
    Activity,
    AlertCircle,
    RefreshCw,
    ChevronLeft,
    History,
    Play,
    Trash2,
    Clock3,
} from 'lucide-react';
import { WideCard, WideCardSkeleton } from '../components/cards/WideCard';
import { ResponsiveModal } from '../components/ResponsiveModal';
import {
    getActiveQuizStates,
    getActiveQuizStateById,
    deleteActiveQuizStateById,
    getConfigKey,
    type ActiveQuizState,
} from '../lib/utils';

// ============================================================================
// TYPES
// ============================================================================
type PracticeState = {
    title: string;
    step: number;
    maxSteps: number;
    showBackButton: boolean;
};

type PracticeViewProps = {
    onStartQuiz: (config: object, resumeId?: string) => void;
    onStateChange: (state: PracticeState) => void;
};

type HistoryItem = {
    step: number;
    item: { id: string | number; label: string; raw?: any };
};

const LOCKED_SUBJECT_IDS: number[] = [];

const LESSON_IMAGES: Record<number, string> = {
    1: 'lordicons/6ea59a8a-30cb-4021-a420-b026d8870572.svg',
    2: 'lordicons/bc0f66dd-c736-4794-979b-f9d56bf4668c.svg',
    4: 'lordicons/122ef337-9a25-44f3-8a35-dc1fad7cb929.svg',
    3: 'lordicons/97596a33-68d4-4457-aaf2-fbf662f21a54.svg',
};

const extractConfigFromHistory = (history: HistoryItem[]) => {
    return {
        subject_id: history.find(h => h.step === 1)?.item.id || null,
        grade_id: history.find(h => h.step === 2)?.item.id || null,
        topic_id: history.find(h => h.step === 3)?.item.id || null,
        chapter_id: history.find(h => h.step === 5)?.item.id || null,
    };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const PracticeView = ({ onStartQuiz, onStateChange }: PracticeViewProps) => {
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [gridItems, setGridItems] = useState<any[]>([]);
    const [pageTitle, setPageTitle] = useState('انتخاب درس');
    const [pageDescription, setPageDescription] = useState('درس مورد نظر خود را برای شروع تمرین انتخاب کنید.');
    const [maxSteps, setMaxSteps] = useState(4);

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [savedQuizzes, setSavedQuizzes] = useState<ActiveQuizState[]>([]);

    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [pendingQuizConfig, setPendingQuizConfig] = useState<Record<string, unknown> | null>(null);
    const [duplicateSavedQuiz, setDuplicateSavedQuiz] = useState<ActiveQuizState | null>(null);

    // --- First-visit guided tour (only shown once; completion is stored server-side) ---
    const { startTour } = useTour();
    const tourTriggeredRef = useRef(false);

    useEffect(() => {
        if (tourTriggeredRef.current || dataLoading || error || step !== 1 || gridItems.length === 0) return;
        tourTriggeredRef.current = true;

        const steps: TourStep[] = [
            {
                selector: '.practice-tour-header',
                title: 'بخش تمرین',
                description: 'در این بخش می‌توانید سوالات را به تفکیک درس، پایه، فصل و مبحث تمرین کنید. در هر مرحله راهنمای انتخاب همین‌جا نمایش داده می‌شود.'
            },
            {
                selector: '.practice-tour-grid',
                title: 'انتخاب درس',
                description: 'ابتدا درس مورد نظر خود را انتخاب کنید. تعداد سوالات موجود و میزان پیشرفت شما روی هر کارت نمایش داده می‌شود.'
            },
            {
                selector: '.practice-tour-history',
                title: 'ادامه آزمون‌های ناتمام',
                description: 'اگر آزمونی را نیمه‌کاره رها کرده باشید، از اینجا می‌توانید آن را مشاهده و از همان‌جا ادامه دهید.'
            }
        ];

        const timer = setTimeout(() => startTour('practice', steps), 700);
        return () => clearTimeout(timer);
    }, [dataLoading, error, step, gridItems.length, startTour]);

    const loadSavedQuizzes = useCallback(() => {
        setSavedQuizzes(getActiveQuizStates());
    }, []);

    const formatElapsedTime = (seconds?: number | null) => {
        const total = Math.max(0, seconds || 0);
        const m = Math.floor(total / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const getSavedQuizElapsed = (item: ActiveQuizState) => {
        return item.timer?.elapsedSeconds ?? 0;
    };

    const openHistoryModal = () => {
        loadSavedQuizzes();
        setIsHistoryModalOpen(true);
    };

    const handleDeleteSavedQuiz = (id: string) => {
        deleteActiveQuizStateById(id);
        loadSavedQuizzes();
    };

    const handleContinueSavedQuiz = (id: string) => {
        const saved = getActiveQuizStateById(id);
        if (!saved) {
            loadSavedQuizzes();
            return;
        }

        setIsHistoryModalOpen(false);
        onStartQuiz(saved.config, id);
    };

    const handleDuplicateContinue = () => {
        if (!duplicateSavedQuiz) return;

        setIsDuplicateModalOpen(false);
        setPendingQuizConfig(null);
        onStartQuiz(duplicateSavedQuiz.config, duplicateSavedQuiz.id);
    };

    const handleDuplicateStartNew = () => {
        if (!pendingQuizConfig) return;

        if (duplicateSavedQuiz?.id) {
            deleteActiveQuizStateById(duplicateSavedQuiz.id);
        }

        setIsDuplicateModalOpen(false);
        setDuplicateSavedQuiz(null);
        onStartQuiz(pendingQuizConfig);
    };

    const handleCloseDuplicateModal = () => {
        setIsDuplicateModalOpen(false);
        setPendingQuizConfig(null);
        setDuplicateSavedQuiz(null);
    };

    const handleFinalStart = (quizConfig: Record<string, unknown>) => {
        const existingItems = getActiveQuizStates();
        const matched = existingItems.find(
            (item) => getConfigKey(item.config) === getConfigKey(quizConfig)
        );

        if (matched) {
            setPendingQuizConfig(quizConfig);
            setDuplicateSavedQuiz(matched);
            setIsDuplicateModalOpen(true);
            return;
        }

        onStartQuiz(quizConfig);
    };

    // Fetch dynamic data
    const fetchGridData = useCallback(async (targetStep: number, currentHistory: HistoryItem[]) => {
        setDataLoading(true);
        setError(null);
        setGridItems([]);

        let title = '';
        let description = '';
        let mappedItems: any[] = [];
        let apiResult = null;

        const getHistoryId = (s: number) => currentHistory.find(h => h.step === s)?.item.id;

        try {
            switch (targetStep) {
                case 1:
                    title = 'انتخاب درس';
                    description = 'درس مورد نظر خود را برای شروع تمرین از لیست زیر انتخاب کنید.';
                    apiResult = await flowApi.dispatch('get_subjects');
                    if (apiResult?.subjects) {
                        mappedItems = apiResult.subjects.map((s: any) => {
                            const subjectId = Number(s.id);

                            return {
                                id: s.id,
                                label: s.title,
                                icon: BookOpen,
                                image: LESSON_IMAGES[subjectId] || null,
                                locked: LOCKED_SUBJECT_IDS.includes(subjectId),
                                count: s.question_count,
                                progress: Number(s.progress_percentage || 0),
                                raw: s,
                            };
                        });

                    }
                    break;

                case 2:
                    title = 'انتخاب پایه';
                    description = 'پایه تحصیلی مربوط به درسی که انتخاب کرده‌اید را مشخص کنید.';
                    apiResult = await flowApi.dispatch('get_grades_by_subject', { subject_id: getHistoryId(1) });
                    if (apiResult?.grades) {
                        mappedItems = apiResult.grades.map((g: any) => ({
                            id: g.id,
                            label: g.title,
                            icon: GraduationCap,
                            count: g.question_count,
                            progress: Number(g.progress_percentage || 0),
                            raw: g,
                        }));
                    }
                    break;

                case 3:
                    title = 'انتخاب فصل';
                    description = 'فصلی که قصد دارید در آن به تمرین و تست‌زنی بپردازید را انتخاب نمایید.';
                    apiResult = await flowApi.dispatch('get_chapters_by_subject', {
                        subject_id: getHistoryId(1),
                        grade_id: getHistoryId(2),
                    });
                    if (apiResult?.chapters) {
                        mappedItems = apiResult.chapters.map((c: any) => ({
                            id: c.id,
                            label: c.title,
                            icon: BookOpen,
                            count: c.question_count,
                            progress: Number(c.progress_percentage || 0),
                            raw: c,
                        }));
                    }
                    break;

                case 4:
                    title = 'نوع آزمون';
                    description = 'مایلید در یک آزمون جامع شرکت کنید یا مباحث خاصی از این فصل را تمرین کنید؟';
                    apiResult = await flowApi.dispatch('get_quiz_types');
                    if (apiResult?.types) {
                        mappedItems = apiResult.types.map((t: any) => ({
                            id: t.key,
                            label: t.title,
                            icon: t.key === 'comprehensive' ? Layers : ListFilter,
                            desc: t.key === 'comprehensive' ? 'شامل تمام مباحث فصل' : 'انتخاب مباحث خاص',
                            raw: t,
                        }));
                    }
                    break;

                case 5:
                    title = 'انتخاب مبحث';
                    description = 'مبحث دقیق مورد نظر خود را برای شروع آزمون مشخص کنید.';
                    apiResult = await flowApi.dispatch('get_mabahes_by_chapter', { topic_id: getHistoryId(3) });
                    if (apiResult?.mabahes) {
                        mappedItems = apiResult.mabahes.map((m: any) => ({
                            id: m.id,
                            label: m.title,
                            icon: Activity,
                            count: m.question_count,
                            progress: Number(m.progress_percentage || 0),
                            raw: m,
                        }));
                    }
                    break;

                default:
                    mappedItems = [];
            }

            if (!apiResult) {
                setError('ارتباط با سرور برقرار نشد. لطفا اینترنت خود را بررسی کنید.');
            } else if (mappedItems.length === 0) {
                setError('اطلاعاتی برای این بخش یافت نشد.');
            }

            setGridItems(mappedItems);
            setPageTitle(title);
            setPageDescription(description);
        } catch (err) {
            setError('خطای نامشخصی رخ داده است.');
        } finally {
            setDataLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGridData(1, []);
    }, [fetchGridData]);

    useEffect(() => {
        onStateChange({ title: pageTitle, step, maxSteps, showBackButton: step > 1 });
    }, [pageTitle, step, maxSteps, onStateChange]);

    const handleBack = useCallback(() => {
        if (history.length === 0) return;

        const newHistory = [...history];
        const lastSelection = newHistory.pop();

        if (lastSelection) {
            const previousStep = lastSelection.step;
            setHistory(newHistory);
            setStep(previousStep);

            if (previousStep < 5) {
                setMaxSteps(4);
            }

            fetchGridData(previousStep, newHistory);
        }
    }, [history, fetchGridData]);

    useEffect(() => {
        const handleExternalBack = () => handleBack();
        window.addEventListener('trigger-practice-back', handleExternalBack);
        return () => window.removeEventListener('trigger-practice-back', handleExternalBack);
    }, [handleBack]);

    const handleCardClick = (item: any) => {
        if (item.locked) return;

        const currentSelection = { step, item };
        const newHistory = [...history, currentSelection];

        if (step === 4) {
            if (item.id === 'comprehensive') {
                const chapter = history.find(h => h.step === 3)?.item;

                const quizConfig = {
                    title: `آزمون جامع ${chapter?.label || ''}`,
                    ...extractConfigFromHistory(newHistory),
                    quiz_type: 'comprehensive',
                };

                handleFinalStart(quizConfig);
                return;
            }

            if (item.id === 'topical') {
                setMaxSteps(5);
                setHistory(newHistory);
                setStep(5);
                fetchGridData(5, newHistory);
                return;
            }
        }

        if (step === 5) {
            const quizConfig = {
                title: `آزمون مبحث: ${item.label}`,
                ...extractConfigFromHistory(newHistory),
                quiz_type: 'topical',
            };

            handleFinalStart(quizConfig);
            return;
        }

        if (step < 5) {
            setHistory(newHistory);
            setStep(step + 1);
            fetchGridData(step + 1, newHistory);
        }
    };


    const getTimeAgoFa = (timestamp: string | number | Date): React.ReactNode => {
        const date = new Date(timestamp);
        const now = new Date();

        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

        const numberClassName = " font-bold text-sm";

        if (diffSeconds < 60) {
            return (
                <>
                    <span className={numberClassName}>{diffSeconds}</span>
                    <span> ثانیه پیش</span>
                </>
            );
        }

        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) {
            return (
                <>
                    <span className={numberClassName}>{diffMinutes}</span>
                    <span> دقیقه پیش</span>
                </>
            );
        }

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return (
                <>
                    <span className={numberClassName}>{diffHours}</span>
                    <span> ساعت پیش</span>
                </>
            );
        }

        const diffDays = Math.floor(diffHours / 24);
        return (
            <>
                <span className={numberClassName}>{diffDays}</span>
                <span> روز پیش</span>
            </>
        );
    };





    const gridClasses = 'practice-tour-grid grid pb-12 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in';

    return (
        <div className="flex-1 px-4 py-8 max-w-7xl mx-auto w-full">
            {!error && (
                <div className="practice-tour-header flex flex-col mb-8 w-full animate-fade-in">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-[var(--text-primary)] md:hidden">
                                {pageTitle}
                            </h2>
                            <p className="hidden md:block text-base text-[var(--text-muted)] leading-relaxed">
                                {pageDescription}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={openHistoryModal}
                                className="practice-tour-history flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 md:bg-black/5 dark:md:bg-white/5 md:px-4 md:py-2 md:rounded-xl"
                                aria-label="تاریخچه آزمون‌ها"
                            >
                                <History size={22} className="md:w-5 md:h-5" />
                                <span className="hidden md:inline text-sm font-medium">تاریخچه</span>
                            </button>

                            {step > 1 ? (
                                <button
                                    onClick={handleBack}
                                    className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 md:bg-black/5 dark:md:bg-white/5 md:px-4 md:py-2 md:rounded-xl"
                                    aria-label="بازگشت"
                                >
                                    <span className="hidden md:inline text-sm font-medium">بازگشت</span>
                                    <ChevronLeft size={28} className="md:w-5 md:h-5" />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed md:hidden">
                        {pageDescription}
                    </p>
                </div>
            )}

            {error ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                        <AlertCircle size={40} className="text-red-500 opacity-90" />
                    </div>
                    <p className="text-lg font-medium text-[var(--text-primary)] mb-8 text-center max-w-md leading-relaxed">
                        {error}
                    </p>
                    <button
                        onClick={() => fetchGridData(step, history)}
                        className="flex items-center gap-2 px-8 py-3 bg-[var(--accent)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl hover:-translate-y-1 transition-all"
                    >
                        <RefreshCw size={20} />
                        تلاش مجدد
                    </button>
                </div>
            ) : (
                <div className={gridClasses}>
                    {dataLoading ? (
                        Array.from({ length: 6 }).map((_, i) => <WideCardSkeleton key={i} />)
                    ) : (
                        gridItems.map((item, i) => (
                            <div
                                key={item.id}
                                onClick={() => handleCardClick(item)}
                                className={item.locked ? 'cursor-not-allowed' : 'cursor-pointer'}
                            >
                                <WideCard
                                    icon={item.icon}
                                    image={item.image}
                                    locked={item.locked}
                                    label={item.label}
                                    progress={step === 4 ? undefined : item.progress ?? 0}
                                    desc={item.count !== undefined ? `${item.count} سوال موجود` : item.desc}
                                    delay={i * 40}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}

            <ResponsiveModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                title="تاریخچه آزمون‌ها"
            >
                <div className="space-y-3">
                    {savedQuizzes.length === 0 ? (
                        <div className="text-sm text-[var(--text-muted)] text-center py-10">
                            هنوز آزمون ذخیره‌شده‌ای وجود ندارد.
                        </div>
                    ) : (
                        savedQuizzes.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-[var(--text-primary)] truncate">
                                            {String(item.config?.title || 'آزمون بدون عنوان')}
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                                            <span>
                                                {item.currentQuestionCount} از {item.totalQuestions}
                                            </span>

                                            <span className="inline-flex items-center gap-1">
                                                <Clock3 size={14} />
                                                {formatElapsedTime(getSavedQuizElapsed(item))}
                                            </span>

                                            <span dir="rtl">
                                               {getTimeAgoFa(item.timestamp)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleContinueSavedQuiz(item.id)}
                                            className="h-10 p-0 w-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center"
                                            aria-label="ادامه"
                                        >
                                            <Play size={18} />
                                        </button>

                                        <button
                                            onClick={() => handleDeleteSavedQuiz(item.id)}
                                            className="h-10 p-0 w-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center"
                                            aria-label="حذف"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ResponsiveModal>

            <ResponsiveModal
                isOpen={isDuplicateModalOpen}
                onClose={handleCloseDuplicateModal}
                title="آزمون ذخیره‌شده پیدا شد"
            >
                <div className="space-y-5">
                    <p className="text-sm leading-7 text-[var(--text-muted)]">
                        برای این تنظیمات، یک آزمون ذخیره‌شده از قبل وجود دارد. می‌خواهید ادامه دهید یا یک آزمون جدید شروع شود؟
                    </p>

                    {duplicateSavedQuiz && (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-sm">
                            <div className="font-bold text-[var(--text-primary)]">
                                {String(duplicateSavedQuiz.config?.title || 'آزمون ذخیره‌شده')}
                            </div>
                            <div className="mt-2 text-[var(--text-muted)]">
                                پیشرفت: {duplicateSavedQuiz.currentQuestionCount} از {duplicateSavedQuiz.totalQuestions}
                            </div>
                            <div className="mt-1 text-[var(--text-muted)]">
                                زمان: {formatElapsedTime(getSavedQuizElapsed(duplicateSavedQuiz))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            onClick={handleDuplicateContinue}
                            className="h-12 rounded-2xl bg-[var(--accent)] text-white font-bold"
                        >
                            ادامه آزمون قبلی
                        </button>

                        <button
                            onClick={handleDuplicateStartNew}
                            className="h-12 rounded-2xl bg-red-500/10 text-red-500 font-bold"
                        >
                            شروع آزمون جدید
                        </button>
                    </div>
                </div>
            </ResponsiveModal>
        </div>
    );
};