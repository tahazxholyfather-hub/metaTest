import React, { useEffect, useMemo, useState } from 'react';
import {
    UserRound, Settings2, History, Lock, Plus, RefreshCw,
    Users, Star, MessageCircle, Sparkles, AlignLeft,
    BookOpen,
    Lightbulb,
    ListChecks,
    Zap,
} from 'lucide-react';

import { AnimatePresence, motion } from 'framer-motion';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import type { AiBook, AiConversationSummary, AiSettings, AiTeacherPublic, AiWallet, ChatStatus } from './types';
import { aiTeacherApi } from './api';
import { personalityItems, skillAxes } from './teacherMeta';
import {
    AiSwitch, GraySpinner, HiddenScroll, PillTabs, PersonalityStrip, RadarChart, SearchField, easeOut,
} from './ui';

type Tab = 'teacher' | 'settings' | 'history';

export const SHORT_WORKING_LABELS: Partial<Record<'sending' | 'thinking' | 'generating', string>> = {
    sending: 'درحال ارسال..',
    thinking: 'در حال تفکر..',
    generating: 'در حال نوشتن..',
};

export type TeacherPanelProps = {
    teacher: AiTeacherPublic | null;
    settings: AiSettings;
    onSettingsChange: (next: AiSettings) => void;
    onChangeTeacher: () => void;
    onSelectConversation: (id: number) => void;
    onNewChat?: () => void;
    /** When true, content flows into parent scroll (mobile sheet) */
    nestScroll?: boolean;
    chatStatus?: ChatStatus;
    wallet?: AiWallet;
};

function formatTime(iso?: string) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('fa-IR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'teacher', label: 'معلم', icon: UserRound },
    { id: 'settings', label: 'تنظیمات', icon: Settings2 },
    { id: 'history', label: 'تاریخچه', icon: History },
];

export function TeacherPanelBody({
    teacher,
    settings,
    onSettingsChange,
    onChangeTeacher,
    onSelectConversation,
    onNewChat,
    nestScroll = true,
    wallet,
}: TeacherPanelProps) {
    const [tab, setTab] = useState<Tab>('teacher');
    const [history, setHistory] = useState<AiConversationSummary[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [books, setBooks] = useState<AiBook[]>([]);
    const [booksLoading, setBooksLoading] = useState(false);
    const [booksEnabled, setBooksEnabled] = useState(!!settings.selectedBookId);

    useEffect(() => {
        if (settings.selectedBookId) setBooksEnabled(true);
    }, [settings.selectedBookId]);

    useEffect(() => {
        if (!booksEnabled) return;
        let alive = true;
        setBooksLoading(true);
        aiTeacherApi.listBooks()
            .then((res) => { if (alive) setBooks(res.data || []); })
            .catch(() => { if (alive) setBooks([]); })
            .finally(() => { if (alive) setBooksLoading(false); });
        return () => { alive = false; };
    }, [booksEnabled]);

    useEffect(() => {
        if (tab !== 'history') return;
        setLoadingHistory(true);
        aiTeacherApi.listConversations({ limit: 40 })
            .then((res) => setHistory(res.data || []))
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false));
    }, [tab]);

    const axes = useMemo(() => (teacher ? skillAxes(teacher) : []), [teacher]);
    const traits = useMemo(() => (teacher ? personalityItems(teacher) : []), [teacher]);

    const filteredHistory = useMemo(() => {
        const q = query.trim();
        if (!q) return history;
        return history.filter((h) =>
            (h.title || '').includes(q) ||
            (h.teacherName || '').includes(q) ||
            (h.teacherSubject || '').includes(q)
        );
    }, [history, query]);

    const persistSettings = async (patch: Partial<AiSettings>) => {
        const prev = settings;
        const next = { ...settings, ...patch };
        onSettingsChange(next);
        setSaving(true);
        try {
            const res = await aiTeacherApi.updateSettings(patch);
            onSettingsChange({ ...next, ...res.data });
        } catch {
            onSettingsChange(prev);
        } finally {
            setSaving(false);
        }
    };

    type BooleanKeys<T> = {
        [K in keyof T]-?: T[K] extends boolean ? K : never;
    }[keyof T];

    type BooleanAiSettingKey = BooleanKeys<AiSettings>;

    const toggle = (
        key: BooleanAiSettingKey,
        value: boolean
    ) => {
        void persistSettings({
            [key]: value,
        });
    };

    const toggleBooks = (on: boolean) => {
        setBooksEnabled(on);
        if (!on) void persistSettings({ selectedBookId: null });
    };

    return (
        <div className={`flex flex-col min-h-0 ${nestScroll ? 'h-full' : ''}`}>
            {onNewChat && (
                <button
                    type="button"
                    onClick={onNewChat}
                    className="mb-3 w-full inline-flex items-center justify-center gap-2 h-10 rounded-[12px] border border-[color-mix(in_srgb,var(--color-primary-500)_28%,var(--border))] text-[13px] font-bold text-[var(--color-primary-400)] hover:bg-[color-mix(in_srgb,var(--color-primary-500)_8%,transparent)] transition-colors"
                >
                    <Plus size={15} />
                    گفتگوی جدید
                </button>
            )}

            <PillTabs tabs={TABS} value={tab} onChange={setTab} className="mb-4 shrink-0" />

            {nestScroll ? (
                <HiddenScroll className="flex-1 min-h-0 -mx-1 px-1">
                    <TabBody
                        tab={tab}
                        teacher={teacher}
                        axes={axes}
                        traits={traits}
                        onChangeTeacher={onChangeTeacher}
                        settings={settings}
                        onToggle={toggle}
                        onBookChange={(id) => void persistSettings({ selectedBookId: id })}
                        books={books}
                        booksEnabled={booksEnabled}
                        booksLoading={booksLoading}
                        onToggleBooks={toggleBooks}
                        saving={saving}
                        loadingHistory={loadingHistory}
                        items={filteredHistory}
                        query={query}
                        onQuery={setQuery}
                        onSelect={onSelectConversation}
                    />
                </HiddenScroll>
            ) : (
                <div className="-mx-1 px-1">
                    <TabBody
                        tab={tab}
                        teacher={teacher}
                        axes={axes}
                        traits={traits}
                        onChangeTeacher={onChangeTeacher}
                        settings={settings}
                        onToggle={toggle}
                        onBookChange={(id) => void persistSettings({ selectedBookId: id })}
                        books={books}
                        booksEnabled={booksEnabled}
                        booksLoading={booksLoading}
                        onToggleBooks={toggleBooks}
                        saving={saving}
                        loadingHistory={loadingHistory}
                        items={filteredHistory}
                        query={query}
                        onQuery={setQuery}
                        onSelect={onSelectConversation}
                    />
                </div>
            )}
        </div>
    );
}

function TabBody({
    tab,
    teacher,
    axes,
    traits,
    onChangeTeacher,
    settings,
    onToggle,
    onBookChange,
    books,
    booksEnabled,
    booksLoading,
    onToggleBooks,
    saving,
    loadingHistory,
    items,
    query,
    onQuery,
    onSelect,
}: {
    tab: Tab;
    teacher: AiTeacherPublic | null;
    axes: { label: string; value: number }[];
    traits: { label: string; Icon: React.ElementType }[];
    onChangeTeacher: () => void;
    settings: AiSettings;
    onToggle: (key: keyof AiSettings, value: boolean) => void;
    onBookChange: (id: number | null) => void;
    books: AiBook[];
    booksEnabled: boolean;
    booksLoading: boolean;
    onToggleBooks: (on: boolean) => void;
    saving: boolean;
    loadingHistory: boolean;
    items: AiConversationSummary[];
    query: string;
    onQuery: (v: string) => void;
    onSelect: (id: number) => void;
}) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: easeOut }}
            >
                {tab === 'teacher' && teacher && (
                    <TeacherOverview
                        teacher={teacher}
                        axes={axes}
                        traits={traits}
                        onChangeTeacher={onChangeTeacher}
                    />
                )}
                {tab === 'settings' && (
                    <SettingsPanel
                        settings={settings}
                        onToggle={onToggle}
                        onBookChange={onBookChange}
                        books={books}
                        booksEnabled={booksEnabled}
                        booksLoading={booksLoading}
                        onToggleBooks={onToggleBooks}
                        saving={saving}
                    />
                )}
                {tab === 'history' && (
                    <HistoryPanel
                        loading={loadingHistory}
                        items={items}
                        query={query}
                        onQuery={onQuery}
                        onSelect={onSelect}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
}

function TeacherOverview({
    teacher,
    axes,
    traits,
    onChangeTeacher,
}: {
    teacher: AiTeacherPublic;
    axes: { label: string; value: number }[];
    traits: { label: string; Icon: React.ElementType }[];
    onChangeTeacher: () => void;
}) {
    return (
        <div className="pb-4 space-y-4">
            <div className="flex flex-col items-center text-center pt-1">
                <div className="relative mb-3">
                    <img
                        src={teacher.avatarUrl || '/avatars/user_default.png'}
                        alt=""
                        className="w-[4.75rem] h-[4.75rem] rounded-full object-cover ring-2 ring-[var(--border)]"
                    />
                    <span className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-card)]" />
                </div>
                <h3 className="text-[16px] font-black text-[var(--text-primary)] tracking-tight">
                    {teacher.displayName}
                </h3>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                    {teacher.subject}
                    {teacher.specialty ? ` · ${teacher.specialty.split(/[،,]/)[0]}` : ''}
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    آنلاین
                </div>
            </div>

            {axes.length >= 3 && (
                <RadarChart axes={axes} size={184} />
            )}

            <PersonalityStrip items={traits} />

            {teacher.stats && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center py-1">
                        <div className="text-[14px] font-black tabular-nums text-[var(--text-primary)] inline-flex items-center gap-1">
                            <Users size={12} className="text-[var(--text-muted)]" />
                            {Number(teacher.stats.students || 0).toLocaleString('fa-IR')}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">دانش‌آموز</div>
                    </div>
                    <div className="text-center py-1">
                        <div className="text-[14px] font-black tabular-nums text-[var(--text-primary)] inline-flex items-center gap-1">
                            <MessageCircle size={12} className="text-[var(--text-muted)]" />
                            {Number(teacher.stats.questionsAnswered || 0).toLocaleString('fa-IR')}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">پاسخ</div>
                    </div>
                    <div className="text-center py-1">
                        <div className="text-[14px] font-black tabular-nums text-amber-400 inline-flex items-center gap-1">
                            <Star size={12} />
                            {teacher.stats.averageRating != null
                                ? Number(teacher.stats.averageRating).toFixed(1)
                                : '—'}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">امتیاز</div>
                    </div>
                </div>
            )}

            <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={onChangeTeacher}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-[12px] border border-[var(--border)] text-[13px] font-bold text-[var(--text-primary)] hover:border-[color-mix(in_srgb,var(--color-primary-500)_35%,var(--border))] hover:text-[var(--color-primary-300)] transition-colors"
            >
                <RefreshCw size={14} />
                تغییر معلم
            </motion.button>
        </div>
    );
}

const SETTING_LINES: {
    key: Exclude<keyof AiSettings, 'selectedBookId'>;
    label: string;
    description: string;
    icon: React.ReactNode;
}[] = [
    {
        key: 'lowCoinMode',
        label: 'مصرف کم انرژی',
        description: 'پاسخ‌ها کوتاه‌تر و کم‌هزینه‌تر باشند',
        icon: <Zap size={15} />,
    },
    {
        key: 'conciseResponses',
        label: 'پاسخ‌های کوتاه‌تر',
        description: 'توضیحات مستقیم و بدون حاشیه باشند',
        icon: <AlignLeft size={15} />,
    },
    {
        key: 'alwaysExamples',
        label: 'همیشه مثال بیاور',
        description: 'برای مفاهیم مهم مثال هم ارائه شود',
        icon: <Lightbulb size={15} />,
    },
    {
        key: 'stepByStep',
        label: 'توضیح گام‌به‌گام',
        description: 'حل مسائل مرحله‌به‌مرحله توضیح داده شود',
        icon: <ListChecks size={15} />,
    },
];

const BOOK_PALETTES = [
    ['#312e81', '#818cf8'],
    ['#134e4a', '#5eead4'],
    ['#881337', '#fb7185'],
    ['#78350f', '#fbbf24'],
];

function BookCover({
    book,
    selected,
    onClick,
}: {
    book: AiBook;
    selected: boolean;
    onClick: () => void;
}) {
    const pal = BOOK_PALETTES[book.id % BOOK_PALETTES.length];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`shrink-0 w-[52px] text-center transition-transform ${selected ? 'scale-[1.04]' : 'opacity-75 hover:opacity-100'}`}
        >
            <span
                className={`relative block h-[74px] w-[52px] rounded-[3px] shadow-md overflow-hidden ${
                    selected ? 'ring-2 ring-[var(--color-primary-400)] ring-offset-1 ring-offset-[var(--bg-card)]' : ''
                }`}
                style={{ background: `linear-gradient(165deg, ${pal[0]}, ${pal[1]})` }}
            >
                <span className="absolute inset-y-0 left-0 w-[5px] bg-black/30" />
                <span className="absolute top-1.5 right-1.5 left-2 text-[8px] font-black text-white/90 leading-tight line-clamp-3 text-right">
                    {book.subject || book.title}
                </span>
                <span className="absolute bottom-1.5 inset-x-1 text-[7px] font-bold text-white/70">
                    {book.grade || ''}
                </span>
            </span>
        </button>
    );
}

function SettingsPanel({
                           settings,
                           onToggle,
                           onBookChange,
                           books,
                           booksEnabled,
                           booksLoading,
                           onToggleBooks,
                           saving,
                       }: {
    settings: AiSettings;
    onToggle: (key: keyof AiSettings, value: boolean) => void;
    onBookChange: (id: number | null) => void;
    books: AiBook[];
    booksEnabled: boolean;
    booksLoading: boolean;
    onToggleBooks: (on: boolean) => void;
    saving: boolean;
}) {
    return (
        <div className="pb-3 space-y-4">

            {/* AI behavior */}
            <section>
                <div className="flex items-center gap-2 px-1 mb-2">
                    <Sparkles
                        size={13}
                        className="text-[var(--color-primary-500)]"
                    />

                    <span className="text-[10px] font-bold text-[var(--text-muted)]">
                        رفتار معلم
                    </span>
                </div>

                <div className="
                    overflow-hidden
                    rounded-[15px]
                    border border-[var(--border)]/60
                    bg-[var(--bg-card)]/35
                ">
                    {SETTING_LINES.map((row, index) => {
                        const checked = !!settings[row.key];

                        return (
                            <button
                                key={row.key}
                                type="button"
                                role="switch"
                                aria-checked={checked}
                                onClick={() =>
                                    onToggle(row.key, !checked)
                                }
                                className={`
                                    group
                                    w-full
                                    flex
                                    items-center
                                    gap-3
                                    px-3
                                    py-3
                                    text-right
                                    transition-colors
                                    hover:bg-[var(--text-primary)]/[0.025]

                                    ${
                                    index > 0
                                        ? 'border-t border-[var(--border)]/40'
                                        : ''
                                }
                                `}
                            >
                                {/* Icon */}
                                <span
                                    className={`
                                        shrink-0
                                        w-8
                                        h-8
                                        rounded-[10px]
                                        flex
                                        items-center
                                        justify-center
                                        transition-all
                                        duration-200

                                        ${
                                        checked
                                            ? `
                                                    bg-[var(--color-primary-500)]/10
                                                    text-[var(--color-primary-500)]
                                                `
                                            : `
                                                    bg-[var(--text-primary)]/[0.04]
                                                    text-[var(--text-muted)]
                                                `
                                    }
                                    `}
                                >
                                    {row.icon}
                                </span>

                                {/* Text */}
                                <span className="flex-1 min-w-0 text-right">
                                    <span className="
                                        block
                                        text-[12px]
                                        font-semibold
                                        text-[var(--text-primary)]
                                        leading-5
                                    ">
                                        {row.label}
                                    </span>

                                    <span className="
                                        block
                                        mt-0.5
                                        text-[9.5px]
                                        leading-4
                                        text-[var(--text-muted)]
                                    ">
                                        {row.description}
                                    </span>
                                </span>

                                {/* Switch */}
                                <AiSwitch
                                    checked={checked}
                                    label={row.label}
                                />
                            </button>
                        );
                    })}
                </div>
            </section>


            {/* Book learning */}
            <section>
                <div className="flex items-center gap-2 px-1 mb-2">
                    <BookOpen
                        size={13}
                        className="text-[var(--color-primary-500)]"
                    />

                    <span className="text-[10px] font-bold text-[var(--text-muted)]">
                        آموزش با کتاب
                    </span>
                </div>

                <div className="
                    overflow-hidden
                    rounded-[15px]
                    border border-[var(--border)]/60
                    bg-[var(--bg-card)]/35
                ">
                    {/* Toggle */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={booksEnabled}
                        onClick={() =>
                            onToggleBooks(!booksEnabled)
                        }
                        className="
                            group
                            w-full
                            flex
                            items-center
                            gap-3
                            px-3
                            py-3
                            text-right
                            transition-colors
                            hover:bg-[var(--text-primary)]/[0.025]
                        "
                    >
                        <span
                            className={`
                                shrink-0
                                w-8
                                h-8
                                rounded-[10px]
                                flex
                                items-center
                                justify-center
                                transition-all
                                duration-200

                                ${
                                booksEnabled
                                    ? `
                                            bg-[var(--color-primary-500)]/10
                                            text-[var(--color-primary-500)]
                                        `
                                    : `
                                            bg-[var(--text-primary)]/[0.04]
                                            text-[var(--text-muted)]
                                        `
                            }
                            `}
                        >
                            <BookOpen size={15} />
                        </span>

                        <span className="flex-1 min-w-0">
                            <span className="
                                block
                                text-[12px]
                                font-semibold
                                text-[var(--text-primary)]
                            ">
                                درس از روی کتاب
                            </span>

                            <span className="
                                block
                                mt-0.5
                                text-[9.5px]
                                text-[var(--text-muted)]
                            ">
                                پاسخ‌ها بر اساس کتاب انتخابی باشند
                            </span>
                        </span>

                        <AiSwitch
                            checked={booksEnabled}
                            label="درس از روی کتاب"
                        />
                    </button>

                    {/* Books */}
                    <AnimatePresence initial={false}>
                        {booksEnabled && (
                            <motion.div
                                initial={{
                                    height: 0,
                                    opacity: 0,
                                }}
                                animate={{
                                    height: 'auto',
                                    opacity: 1,
                                }}
                                exit={{
                                    height: 0,
                                    opacity: 0,
                                }}
                                transition={{
                                    duration: 0.22,
                                    ease: 'easeOut',
                                }}
                                className="overflow-hidden"
                            >
                                <div className="
                                    border-t
                                    border-[var(--border)]/40
                                    px-3
                                    py-3
                                ">
                                    {booksLoading ? (
                                        <div className="flex justify-center py-4">
                                            <GraySpinner size={17} />
                                        </div>
                                    ) : books.length === 0 ? (
                                        <div className="
                                            py-4
                                            text-center
                                            text-[10px]
                                            text-[var(--text-muted)]
                                        ">
                                            کتابی در دسترس نیست
                                        </div>
                                    ) : (
                                        <>
                                            <div className="
                                                flex
                                                items-center
                                                justify-between
                                                mb-2
                                            ">
                                                <span className="
                                                    text-[9px]
                                                    font-medium
                                                    text-[var(--text-muted)]
                                                ">
                                                    انتخاب کتاب
                                                </span>

                                                {settings.selectedBookId && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onBookChange(null)
                                                        }
                                                        className="
                                                            text-[9px]
                                                            text-[var(--color-primary-500)]
                                                            hover:opacity-70
                                                        "
                                                    >
                                                        حذف
                                                    </button>
                                                )}
                                            </div>

                                            <div className="
                                                overflow-x-auto
                                                hide-scrollbar
                                            ">
                                                <div className="flex gap-2.5 py-1">
                                                    {books.map((book) => (
                                                        <BookCover
                                                            key={book.id}
                                                            book={book}
                                                            selected={
                                                                settings.selectedBookId ===
                                                                book.id
                                                            }
                                                            onClick={() =>
                                                                onBookChange(
                                                                    settings.selectedBookId ===
                                                                    book.id
                                                                        ? null
                                                                        : book.id
                                                                )
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>


            {/* Parent reports */}
            <button
                type="button"
                role="switch"
                aria-checked={settings.parentReportsEnabled}
                onClick={() =>
                    onToggle(
                        'parentReportsEnabled',
                        !settings.parentReportsEnabled
                    )
                }
                className="
                    w-full
                    flex
                    items-center
                    gap-3
                    px-3
                    py-3
                    rounded-[15px]
                    border
                    border-[var(--border)]/50
                    bg-[var(--bg-card)]/25
                    text-right
                    transition-colors
                    hover:bg-[var(--text-primary)]/[0.025]
                "
            >
                <span className="
                    w-8 h-8
                    shrink-0
                    rounded-[10px]
                    flex
                    items-center
                    justify-center
                    bg-[var(--text-primary)]/[0.04]
                    text-[var(--text-muted)]
                ">
                    <Lock size={14} />
                </span>

                <span className="flex-1 min-w-0">
                    <span className="
                        block
                        text-[11px]
                        font-semibold
                        text-[var(--text-primary)]
                    ">
                        گزارش والدین
                    </span>

                    <span className="
                        block
                        mt-0.5
                        text-[9px]
                        text-[var(--text-muted)]
                    ">
                        این قابلیت هنوز فعال نشده است
                    </span>
                </span>

                <span className="
                    shrink-0
                    px-1.5
                    py-0.5
                    rounded-full
                    bg-[var(--text-primary)]/[0.05]
                    text-[8px]
                    text-[var(--text-muted)]
                ">
                    به‌زودی
                </span>
            </button>


            {/* Saving */}
            <AnimatePresence>
                {saving && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="
                            flex
                            items-center
                            justify-center
                            gap-1.5
                            text-[9px]
                            text-[var(--text-muted)]
                        "
                    >
                        <GraySpinner size={11} />
                        در حال ذخیره…
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function HistoryPanel({
    loading,
    items,
    query,
    onQuery,
    onSelect,
}: {
    loading: boolean;
    items: AiConversationSummary[];
    query: string;
    onQuery: (v: string) => void;
    onSelect: (id: number) => void;
}) {
    return (
        <div className="pb-4 space-y-3">
            <SearchField
                value={query}
                onChange={onQuery}
                placeholder="جستجو در گفتگوها…"
            />

            {loading ? (
                <div className="flex justify-center py-12">
                    <GraySpinner size={22} />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-12 px-4">
                    <History className="mx-auto mb-3 text-[var(--text-muted)]" size={28} strokeWidth={1.5} />
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                        {query ? 'نتیجه‌ای پیدا نشد' : 'هنوز گفتگویی ندارید'}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)] mt-1.5 leading-6">
                        {query ? 'عبارت دیگری را امتحان کنید.' : 'اولین گفتگو را شروع کنید تا اینجا نمایش داده شود.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-0.5">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className="w-full text-right flex items-center gap-3 px-2 py-3 rounded-[12px] hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] transition-colors group"
                        >
                            <img
                                src={item.teacherAvatar || '/avatars/user_default.png'}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-[var(--border)]"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--color-primary-300)] transition-colors">
                                    {item.title || 'گفتگو'}
                                </div>
                                <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 flex items-center justify-between gap-2">
                                    <span className="truncate">{item.teacherName || item.teacherSubject || 'معلم'}</span>
                                    <span className="shrink-0 tabular-nums">{formatTime(item.lastMessageAt || item.createdAt)}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Desktop left side panel — always open, never closable */
export function DesktopAiSidePanel({
    chatStatus = 'ready',
    wallet,
    ...panel
}: TeacherPanelProps) {
    return (
        <aside
            className="hidden md:flex shrink-0 h-full w-[320px] border-r border-[var(--border)]/70 bg-[var(--bg-card)] overflow-hidden flex-col"
            dir="rtl"
            data-chat-status={chatStatus}
        >
            <div className="flex-1 min-h-0 p-3.5">
                <TeacherPanelBody {...panel} nestScroll wallet={wallet} chatStatus={chatStatus} />
            </div>
        </aside>
    );
}

/** Mobile bottom sheet */
export function MenuSheet({
    open,
    onClose,
    ...panel
}: TeacherPanelProps & { open: boolean; onClose: () => void }) {
    return (
        <ResponsiveModal
            isOpen={open}
            onClose={onClose}
            title={panel.teacher?.displayName || 'معلم'}
            className="md:w-[420px]"
            sheetMaxHeight="92dvh"
            bodyClassName="!pt-1 !pb-6"
        >
            <TeacherPanelBody {...panel} nestScroll={false} />
        </ResponsiveModal>
    );
}
