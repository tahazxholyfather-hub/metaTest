import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    MessageSquare, Gamepad2, Plus, Pencil, Trash2, Check, X, History as HistoryIcon,
} from 'lucide-react';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import { Met, chatStatusToMetState, type MetHandle } from '../../components/met';
import type { AiConversationSummary, AiSubject, ChatStatus } from './types';
import { SubjectIcon } from './subjectIcons';
import { GraySpinner, HiddenScroll, PillTabs, easeOut } from './ui';

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
    metSize?: number;
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

function subjectMeta(subjects: AiSubject[], key?: string) {
    return subjects.find((s) => s.key === key) || null;
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
                        {subject?.nameFa || ''} · {formatTime(item.lastMessageAt || item.createdAt)}
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

function ChatHistory({
    conversations,
    loading,
    activeConversationId,
    subjects,
    onSelectConversation,
    onRenameConversation,
    onDeleteConversation,
}: Omit<SidePanelProps, 'onNewChat' | 'chatStatus' | 'metSize'>) {
    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <GraySpinner size={20} />
            </div>
        );
    }

    if (!conversations.length) {
        return (
            <div className="text-center py-10 px-4">
                <HistoryIcon className="mx-auto mb-3 text-[var(--text-muted)]" size={26} strokeWidth={1.5} />
                <p className="text-[13px] font-bold text-[var(--text-primary)]">هنوز گفتگویی نداری</p>
                <p className="text-[11.5px] text-[var(--text-muted)] mt-1.5 leading-6">
                    یک موضوع را انتخاب کن و اولین سؤالت را بپرس — همین‌جا نمایش داده می‌شود.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            {conversations.map((item) => (
                <HistoryRow
                    key={item.id}
                    item={item}
                    active={item.id === activeConversationId}
                    subject={subjectMeta(subjects, item.subjectKey)}
                    onSelect={() => onSelectConversation(item.id)}
                    onRename={(title) => onRenameConversation(item.id, title)}
                    onDelete={() => onDeleteConversation(item.id)}
                />
            ))}
        </div>
    );
}

function SidePanelBody(props: SidePanelProps) {
    const [tab, setTab] = useState<SidePanelTab>('chat');
    const metRef = useRef<MetHandle>(null);
    const metState = useMemo(() => chatStatusToMetState(props.chatStatus || 'ready'), [props.chatStatus]);

    return (
        <div className="flex flex-col min-h-0 h-full">
            <PillTabs tabs={TABS} value={tab} onChange={setTab} className="mb-4 shrink-0" />

            <div className="flex justify-center py-1 mb-3 shrink-0">
                <div style={{ width: props.metSize ?? 96, height: props.metSize ?? 96 }}>
                    <Met ref={metRef} size="100%" state={metState} mood="calm" interactive energy={0.55} />
                </div>
            </div>

            <HiddenScroll className="flex-1 min-h-0 -mx-1 px-1">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={tab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: easeOut }}
                    >
                        {tab === 'chat' ? <ChatHistory {...props} /> : <GamePlaceholder />}
                    </motion.div>
                </AnimatePresence>
            </HiddenScroll>

            <button
                type="button"
                onClick={props.onNewChat}
                className="mt-3 shrink-0 w-full inline-flex items-center justify-center gap-2 h-11 rounded-[12px] bg-[var(--color-primary-500)] text-[13px] font-bold text-white hover:bg-[var(--color-primary-600)] transition-colors shadow-[0_2px_10px_rgba(124,58,237,0.18)]"
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
        <ResponsiveModal isOpen={open} onClose={onClose} title="Met" className="md:w-[420px]">
            <div className="h-[70vh] flex flex-col">
                <SidePanelBody {...props} metSize={80} />
            </div>
        </ResponsiveModal>
    );
}
