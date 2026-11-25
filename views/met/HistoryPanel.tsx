import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MessageSquareText, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, metApi } from './api';
import type { MetConversation, MetSubject, SubjectKey } from './types';
import { SlugIcon, findSubject } from './subjectIcons';
import { EmptyHint, GraySpinner, SearchField, easeOut, formatRelativeDay } from './ui';

type Props = {
    subjects: MetSubject[];
    activeConversationId: number | null;
    /** Bumps whenever the active conversation's title / list order may have changed. */
    refreshKey?: number;
    onOpen: (id: number) => void;
    onDeleted: (id: number) => void;
    className?: string;
};

const PAGE = 30;

export function HistoryPanel({ subjects, activeConversationId, refreshKey = 0, onOpen, onDeleted, className = '' }: Props) {
    const [items, setItems] = useState<MetConversation[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<SubjectKey | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draft, setDraft] = useState('');
    const [confirmId, setConfirmId] = useState<number | null>(null);
    const reqRef = useRef(0);

    const load = useCallback(
        async (reset: boolean) => {
            const seq = ++reqRef.current;
            setLoading(true);
            try {
                const offset = reset ? 0 : items.length;
                const res = await metApi.listConversations({ limit: PAGE, offset, subject: filter, q: query.trim() || undefined });
                if (seq !== reqRef.current) return;
                setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
                setHasMore(res.hasMore);
            } catch (err) {
                if (seq === reqRef.current) toast.error(errorMessage(err, 'تاریخچه بارگذاری نشد'));
            } finally {
                if (seq === reqRef.current) setLoading(false);
            }
        },
        [filter, query, items.length]
    );

    useEffect(() => {
        const t = window.setTimeout(() => void load(true), query ? 250 : 0);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, query, refreshKey]);

    const rename = async (c: MetConversation) => {
        const title = draft.trim();
        setEditingId(null);
        if (!title || title === c.title) return;
        try {
            const saved = await metApi.renameConversation(c.id, title);
            setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, title: saved } : x)));
        } catch (err) {
            toast.error(errorMessage(err, 'تغییر عنوان ناموفق بود'));
        }
    };

    const remove = async (id: number) => {
        setConfirmId(null);
        try {
            await metApi.deleteConversation(id);
            setItems((prev) => prev.filter((x) => x.id !== id));
            onDeleted(id);
        } catch (err) {
            toast.error(errorMessage(err, 'حذف گفتگو ناموفق بود'));
        }
    };

    const filters: { key: SubjectKey | null; label: string }[] = [
        { key: null, label: 'همه' },
        ...subjects.map((s) => ({ key: s.key as SubjectKey | null, label: s.nameFa })),
    ];

    return (
        <div className={`flex flex-col min-h-0 ${className}`} dir="rtl">
            <div className="px-1 pb-2 space-y-2">
                <SearchField value={query} onChange={setQuery} placeholder="جستجو در گفتگوها…" />
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1 py-0.5">
                    {filters.map((f) => {
                        const active = filter === f.key;
                        return (
                            <button
                                key={String(f.key)}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${
                                    active
                                        ? 'bg-[var(--color-primary-500)]/14 border-[var(--color-primary-500)]/40 text-[var(--color-primary-300)]'
                                        : 'border-[var(--border)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar px-1 pb-2">
                {loading && items.length === 0 ? (
                    <div className="py-10 grid place-items-center"><GraySpinner /></div>
                ) : items.length === 0 ? (
                    <EmptyHint icon={<MessageSquareText size={22} />} title="گفتگویی نیست" body={query ? 'چیزی با این عبارت پیدا نشد.' : 'اولین سؤالت را از مِت بپرس؛ گفتگوها اینجا ذخیره می‌شوند.'} />
                ) : (
                    <ul className="space-y-1 m-0 p-0 list-none">
                        <AnimatePresence initial={false}>
                            {items.map((c) => {
                                const subject = findSubject(subjects, c.subjectKey);
                                const active = c.id === activeConversationId;
                                const editing = editingId === c.id;
                                const confirming = confirmId === c.id;
                                return (
                                    <motion.li
                                        key={c.id}
                                        layout
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.18, ease: easeOut }}
                                        className={`group relative rounded-[14px] border transition-colors ${
                                            active ? 'bg-[var(--color-primary-500)]/10 border-[var(--color-primary-500)]/30' : 'border-transparent hover:bg-[var(--hover-overlay)]'
                                        }`}
                                    >
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => !editing && onOpen(c.id)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !editing) onOpen(c.id); }}
                                            className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer"
                                        >
                                            <span
                                                className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0"
                                                style={{ background: `color-mix(in srgb, ${subject.color} 16%, transparent)`, color: subject.color }}
                                            >
                                                <SlugIcon icon={subject.icon} size={14} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                {editing ? (
                                                    <input
                                                        autoFocus
                                                        value={draft}
                                                        onChange={(e) => setDraft(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') void rename(c); if (e.key === 'Escape') setEditingId(null); }}
                                                        onBlur={() => void rename(c)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        maxLength={80}
                                                        className="w-full bg-transparent border-b border-[var(--color-primary-500)]/60 outline-none text-[12.5px] font-bold text-[var(--text-primary)] py-0.5"
                                                    />
                                                ) : (
                                                    <div className="text-[12.5px] font-bold text-[var(--text-primary)] truncate">{c.title}</div>
                                                )}
                                                <div className="text-[10.5px] text-[var(--text-muted)] truncate mt-0.5">
                                                    {subject.nameFa} · {formatRelativeDay(c.lastMessageAt || c.createdAt)}
                                                </div>
                                            </div>

                                            {!editing && !confirming && (
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setDraft(c.title); setEditingId(c.id); }} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]" aria-label="تغییر عنوان">
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmId(c.id); }} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10" aria-label="حذف">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                            {confirming && (
                                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <button type="button" onClick={() => remove(c.id)} className="h-7 px-2 rounded-md bg-rose-500/15 text-rose-400 text-[11px] font-bold inline-flex items-center gap-1">
                                                        <Check size={12} /> حذف
                                                    </button>
                                                    <button type="button" onClick={() => setConfirmId(null)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]" aria-label="انصراف">
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.li>
                                );
                            })}
                        </AnimatePresence>
                    </ul>
                )}

                {hasMore && !loading && (
                    <button type="button" onClick={() => void load(false)} className="mt-2 w-full h-9 rounded-[12px] text-[12px] font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
                        نمایش بیشتر
                    </button>
                )}
                {loading && items.length > 0 && <div className="py-3 grid place-items-center"><GraySpinner size={16} /></div>}
            </div>
        </div>
    );
}

export default HistoryPanel;
