import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    MessageSquare, Gamepad2, Plus, Pencil, Trash2, Check, X,
    History as HistoryIcon, Settings2, ChevronDown,
    Zap, AlignLeft, Lightbulb, ListChecks, Volume2,
} from 'lucide-react';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import { Met, chatStatusToMetState, subjectToMetColor, type MetHandle } from '../../components/met';
import type { AiConversationSummary, AiSettings, AiSubject, ChatStatus, SubjectKey } from './types';
import { SubjectIcon } from './subjectIcons';
import { AiSwitch, GraySpinner, HiddenScroll, PillTabs, SearchField, easeOut } from './ui';

type SidePanelTab = 'chat' | 'game';

export type SidePanelProps = {
    conversations: AiConversationSummary[];
    loadingConversations?: boolean;
    activeConversationId?: number | null;
    onSelectConversation: (id: number) => void;
    onNewChat: () => void;
    onRenameConversation: (id: number, title: string) => void;
    onDeleteConversation: (id: number) => void;
    chatStatus?: ChatStatus;
    subjects: AiSubject[];
    activeSubjectKey: SubjectKey;
    onSubjectChange: (key: SubjectKey) => void;
    settings: AiSettings;
    onSettingsChange: (patch: Partial<AiSettings>) => void;
    voiceEnabled?: boolean;
};

const TABS: { id: SidePanelTab; label: string; icon: React.ElementType }[] = [
    { id: 'chat', label: 'چت', icon: MessageSquare },
    { id: 'game', label: 'بازی', icon: Gamepad2 },
];

function formatTime(iso?: string) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

/** Circular distance so 4 subjects wrap around the center slot. */
function circularDelta(index: number, activeIndex: number, length: number) {
    let d = index - activeIndex;
    if (d > length / 2) d -= length;
    if (d < -length / 2) d += length;
    return d;
}

/**
 * Met color slider — the center character is large and alive, the previous
 * and next subjects peek from the sides, smaller and faded. Click a side
 * character or swipe to change the active subject.
 */
export function MetSubjectSlider({
    subjects,
    activeKey,
    onChange,
    chatStatus = 'ready',
    size = 92,
}: {
    subjects: AiSubject[];
    activeKey: SubjectKey;
    onChange: (key: SubjectKey) => void;
    chatStatus?: ChatStatus;
    size?: number;
}) {
    const metRef = useRef<MetHandle>(null);
    const activeIndex = Math.max(0, subjects.findIndex((s) => s.key === activeKey));
    const active = subjects[activeIndex];
    const metState = useMemo(() => chatStatusToMetState(chatStatus), [chatStatus]);

    const go = (dir: 1 | -1) => {
        const next = subjects[(activeIndex + dir + subjects.length) % subjects.length];
        onChange(next.key);
    };

    return (
        <div className="select-none">
            <motion.div
                className="relative mx-auto"
                style={{ height: size + 18, width: '100%', touchAction: 'pan-y' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={(_, info) => {
                    if (info.offset.x > 42) go(-1);
                    else if (info.offset.x < -42) go(1);
                }}
            >
                {subjects.map((s, i) => {
                    const delta = circularDelta(i, activeIndex, subjects.length);
                    const isCenter = delta === 0;
                    const hidden = Math.abs(delta) > 1;
                    const side = Math.round(size * 0.58);
                    return (
                        // Not a <button>: the interactive Met renders its own internal
                        // hit button and nested buttons are invalid HTML.
                        <motion.div
                            key={s.key}
                            role={isCenter ? undefined : 'button'}
                            tabIndex={isCenter || hidden ? -1 : 0}
                            aria-label={s.nameFa}
                            onClick={() => { if (!isCenter && !hidden) onChange(s.key); }}
                            onKeyDown={(e) => {
                                if (!isCenter && !hidden && (e.key === 'Enter' || e.key === ' ')) onChange(s.key);
                            }}
                            className="absolute top-1/2 left-1/2 p-0"
                            style={{ cursor: isCenter ? 'default' : 'pointer' }}
                            animate={{
                                x: `calc(-50% + ${delta * (size * 0.82)}px)`,
                                y: '-50%',
                                scale: isCenter ? 1 : 0.6,
                                opacity: hidden ? 0 : isCenter ? 1 : 0.35,
                                zIndex: isCenter ? 2 : 1,
                            }}
                            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        >
                            <div style={{ width: isCenter ? size : side, height: isCenter ? size : side, pointerEvents: isCenter ? 'auto' : 'none' }}>
                                <Met
                                    ref={isCenter ? metRef : undefined}
                                    size="100%"
                                    color={subjectToMetColor(s.key)}
                                    state={isCenter ? metState : 'idle'}
                                    interactive={isCenter}
                                    reducedMotion={!isCenter}
                                    atmosphere={isCenter}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            <div className="flex items-center justify-center gap-1.5 mt-1">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={active?.key}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.18, ease: easeOut }}
                        className="inline-flex items-center gap-1.5 text-[12px] font-black"
                        style={{ color: active?.color }}
                    >
                        <SubjectIcon icon={active?.icon} size={12} />
                        {active?.nameFa}
                    </motion.span>
                </AnimatePresence>
            </div>
            <div className="flex justify-center gap-1 mt-1.5">
                {subjects.map((s) => (
                    <button
                        key={s.key}
                        type="button"
                        aria-label={s.nameFa}
                        onClick={() => onChange(s.key)}
                        className="p-0.5"
                    >
                        <span
                            className="block w-1.5 h-1.5 rounded-full transition-all"
                            style={{
                                background: s.key === activeKey ? s.color : 'var(--border-strong)',
                                transform: s.key === activeKey ? 'scale(1.35)' : 'scale(1)',
                            }}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

function GamePlaceholder() {
    return (
        <div className="flex flex-col items-center justify-center text-center py-14 px-4">
            <span className="w-14 h-14 rounded-2xl bg-[color-mix(in_srgb,var(--color-primary-500)_12%,transparent)] text-[var(--color-primary-400)] inline-flex items-center justify-center mb-3">
                <Gamepad2 size={24} />
            </span>
            <p className="text-sm font-bold text-[var(--text-primary)]">بازی‌های آموزشی به‌زودی</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1.5 leading-6 max-w-[220px]">
                چالش‌های سرگرم‌کننده برای تمرین ریاضی، زیست، فیزیک و شیمی در راه است.
            </p>
        </div>
    );
}

function HistoryRow({
    item,
    active,
    subject,
    onSelect,
    onRename,
    onDelete,
}: {
    item: AiConversationSummary;
    active: boolean;
    subject: AiSubject | null;
    onSelect: () => void;
    onRename: (title: string) => void;
    onDelete: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.title);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const commit = () => {
        const clean = draft.trim();
        setEditing(false);
        if (clean && clean !== item.title) onRename(clean);
        else setDraft(item.title);
    };

    return (
        <div
            className={`group relative w-full rounded-[12px] transition-colors ${
                active ? 'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)]'
            }`}
        >
            <button
                type="button"
                onClick={editing ? undefined : onSelect}
                className="w-full text-right flex items-center gap-2.5 px-2 py-2.5"
            >
                <span
                    className="w-8 h-8 rounded-[10px] inline-flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${subject?.color || '#8B5CF6'} 16%, transparent)`, color: subject?.color || 'var(--color-primary-400)' }}
                >
                    <SubjectIcon icon={subject?.icon} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                    {editing ? (
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commit();
                                if (e.key === 'Escape') { setDraft(item.title); setEditing(false); }
                            }}
                            onBlur={commit}
                            autoFocus
                            className="w-full bg-transparent border-b border-[var(--color-primary-500)]/50 text-[12.5px] font-bold text-[var(--text-primary)] outline-none pb-0.5"
                        />
                    ) : (
                        <div className={`text-[12.5px] font-bold truncate transition-colors ${active ? 'text-[var(--color-primary-300)]' : 'text-[var(--text-primary)]'}`}>
                            {item.title || 'گفتگو'}
                        </div>
                    )}
                    <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 truncate">
                        {formatTime(item.lastMessageAt || item.createdAt)}
                    </div>
                </div>
            </button>

            {!editing && (
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {confirmingDelete ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                                aria-label="تأیید حذف"
                            >
                                <Check size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--text-primary)]/5"
                                aria-label="انصراف"
                            >
                                <X size={13} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5"
                                aria-label="ویرایش عنوان"
                            >
                                <Pencil size={12.5} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                                aria-label="حذف گفتگو"
                            >
                                <Trash2 size={12.5} />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

const SETTING_ROWS: { key: keyof AiSettings; label: string; description: string; icon: React.ReactNode; needsVoice?: boolean }[] = [
    { key: 'efficientMode', label: 'مصرف بهینه', description: 'پاسخ‌های کوتاه‌تر و کم‌هزینه‌تر', icon: <Zap size={14} /> },
    { key: 'shortAnswers', label: 'پاسخ‌های کوتاه', description: 'توضیح مستقیم و بدون حاشیه', icon: <AlignLeft size={14} /> },
    { key: 'alwaysExamples', label: 'همیشه مثال بیاور', description: 'برای مفاهیم مهم مثال ارائه شود', icon: <Lightbulb size={14} /> },
    { key: 'stepByStep', label: 'توضیح گام‌به‌گام', description: 'حل مسائل مرحله‌به‌مرحله', icon: <ListChecks size={14} /> },
    { key: 'voiceReplies', label: 'پاسخ صوتی', description: 'امکان شنیدن پاسخ‌های مِت', icon: <Volume2 size={14} />, needsVoice: true },
];

function SettingsSection({
    settings,
    onSettingsChange,
    voiceEnabled,
}: {
    settings: AiSettings;
    onSettingsChange: (patch: Partial<AiSettings>) => void;
    voiceEnabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const rows = SETTING_ROWS.filter((r) => !r.needsVoice || voiceEnabled);
    return (
        <div className="shrink-0 mt-2">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-2 py-2 rounded-[10px] text-[11.5px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.03] transition-colors"
                aria-expanded={open}
            >
                <span className="inline-flex items-center gap-1.5">
                    <Settings2 size={13} />
                    تنظیمات مِت
                </span>
                <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: easeOut }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-[13px] border border-[var(--border)]/60 overflow-hidden mt-1">
                            {rows.map((row, i) => {
                                const checked = !!settings[row.key];
                                return (
                                    <button
                                        key={row.key}
                                        type="button"
                                        role="switch"
                                        aria-checked={checked}
                                        onClick={() => onSettingsChange({ [row.key]: !checked })}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 text-right transition-colors hover:bg-[var(--text-primary)]/[0.025] ${
                                            i > 0 ? 'border-t border-[var(--border)]/40' : ''
                                        }`}
                                    >
                                        <span className={`shrink-0 w-7 h-7 rounded-[9px] inline-flex items-center justify-center ${
                                            checked ? 'bg-[var(--color-primary-500)]/10 text-[var(--color-primary-500)]' : 'bg-[var(--text-primary)]/[0.04] text-[var(--text-muted)]'
                                        }`}>
                                            {row.icon}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[11.5px] font-semibold text-[var(--text-primary)] leading-4">{row.label}</span>
                                            <span className="block mt-0.5 text-[9.5px] leading-4 text-[var(--text-muted)]">{row.description}</span>
                                        </span>
                                        <AiSwitch checked={checked} label={row.label} />
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ChatHistory({
    conversations,
    loading,
    activeConversationId,
    subjects,
    activeSubjectKey,
    query,
    onSelectConversation,
    onRenameConversation,
    onDeleteConversation,
}: {
    conversations: AiConversationSummary[];
    loading?: boolean;
    activeConversationId?: number | null;
    subjects: AiSubject[];
    activeSubjectKey: SubjectKey;
    query: string;
    onSelectConversation: (id: number) => void;
    onRenameConversation: (id: number, title: string) => void;
    onDeleteConversation: (id: number) => void;
}) {
    const subject = subjects.find((s) => s.key === activeSubjectKey) || null;
    const filtered = useMemo(() => {
        const q = query.trim();
        return conversations
            .filter((c) => c.subjectKey === activeSubjectKey)
            .filter((c) => !q || (c.title || '').includes(q));
    }, [conversations, activeSubjectKey, query]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <GraySpinner size={20} />
            </div>
        );
    }

    if (!filtered.length) {
        return (
            <div className="text-center py-9 px-4">
                <HistoryIcon className="mx-auto mb-3 text-[var(--text-muted)]" size={24} strokeWidth={1.5} />
                <p className="text-[13px] font-bold text-[var(--text-primary)]">
                    {query ? 'نتیجه‌ای پیدا نشد' : `هنوز گفتگویی در ${subject?.nameFa || 'این درس'} نداری`}
                </p>
                <p className="text-[11.5px] text-[var(--text-muted)] mt-1.5 leading-6">
                    {query ? 'عبارت دیگری را جستجو کن.' : 'اولین سؤالت را بپرس — همین‌جا نمایش داده می‌شود.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            {filtered.map((item) => (
                <HistoryRow
                    key={item.id}
                    item={item}
                    active={item.id === activeConversationId}
                    subject={subjects.find((s) => s.key === item.subjectKey) || null}
                    onSelect={() => onSelectConversation(item.id)}
                    onRename={(title) => onRenameConversation(item.id, title)}
                    onDelete={() => onDeleteConversation(item.id)}
                />
            ))}
        </div>
    );
}

function SidePanelBody(props: SidePanelProps & { metSize?: number }) {
    const [tab, setTab] = useState<SidePanelTab>('chat');
    const [query, setQuery] = useState('');

    return (
        <div className="flex flex-col min-h-0 h-full">
            <PillTabs tabs={TABS} value={tab} onChange={setTab} className="mb-3 shrink-0" />

            <div className="shrink-0 mb-2">
                <MetSubjectSlider
                    subjects={props.subjects}
                    activeKey={props.activeSubjectKey}
                    onChange={props.onSubjectChange}
                    chatStatus={props.chatStatus}
                    size={props.metSize ?? 92}
                />
            </div>

            {tab === 'chat' && (
                <div className="shrink-0 mb-2">
                    <SearchField value={query} onChange={setQuery} placeholder="جستجو در گفتگوها…" />
                </div>
            )}

            <HiddenScroll className="flex-1 min-h-0 -mx-1 px-1">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={tab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: easeOut }}
                    >
                        {tab === 'chat' ? (
                            <ChatHistory
                                conversations={props.conversations}
                                loading={props.loadingConversations}
                                activeConversationId={props.activeConversationId}
                                subjects={props.subjects}
                                activeSubjectKey={props.activeSubjectKey}
                                query={query}
                                onSelectConversation={props.onSelectConversation}
                                onRenameConversation={props.onRenameConversation}
                                onDeleteConversation={props.onDeleteConversation}
                            />
                        ) : (
                            <GamePlaceholder />
                        )}
                    </motion.div>
                </AnimatePresence>
            </HiddenScroll>

            <SettingsSection
                settings={props.settings}
                onSettingsChange={props.onSettingsChange}
                voiceEnabled={props.voiceEnabled}
            />

            <button
                type="button"
                onClick={props.onNewChat}
                className="mt-2 shrink-0 w-full inline-flex items-center justify-center gap-2 h-11 rounded-[12px] bg-[var(--color-primary-500)] text-[13px] font-bold text-white hover:bg-[var(--color-primary-600)] transition-colors shadow-[0_2px_10px_rgba(124,58,237,0.18)]"
            >
                <Plus size={16} />
                گفتگوی جدید
            </button>
        </div>
    );
}

/** Desktop left side panel — always open, never closable. */
export function DesktopAiSidePanel(props: SidePanelProps) {
    return (
        <aside
            className="hidden md:flex shrink-0 h-full w-[320px] border-r border-[var(--border)]/70 bg-[var(--bg-card)] overflow-hidden flex-col"
            dir="rtl"
        >
            <div className="flex-1 min-h-0 p-3.5">
                <SidePanelBody {...props} />
            </div>
        </aside>
    );
}

/** Mobile bottom-sheet — opened by the history button in the chat header. */
export function MobileHistorySheet({
    open,
    onClose,
    ...props
}: SidePanelProps & { open: boolean; onClose: () => void }) {
    return (
        <ResponsiveModal isOpen={open} onClose={onClose} title="مِت">
            <div className="h-[72vh] flex flex-col">
                <SidePanelBody {...props} metSize={78} />
            </div>
        </ResponsiveModal>
    );
}
