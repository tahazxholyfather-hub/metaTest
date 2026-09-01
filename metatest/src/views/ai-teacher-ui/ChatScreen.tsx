import React, { useEffect, useRef, useState } from 'react';
import {
    Send, ImagePlus, X, LogOut, History as HistoryIcon, Plus, ChevronDown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AiAttachment, AiMessage, AiSubject, AiWallet, ChatStatus, SubjectKey } from './types';
import { MessageBubble } from './MessageBubble';
import { aiTeacherApi } from './api';
import { Met, chatStatusToMetState, type MetHandle } from '../../components/met';
import { SubjectIcon } from './subjectIcons';
import { SUBJECT_SUGGESTIONS, type Suggestion } from './suggestions';
import {
    AiPageShell,
    ChatScroll,
    EnergyMeter,
    TypingIndicator,
    easeOut,
    useIsMobile,
} from './ui';

type Props = {
    subjects: AiSubject[];
    activeSubjectKey: SubjectKey;
    onSubjectChange: (key: SubjectKey) => void;
    conversationId: number | null;
    conversationTitle: string;
    initialMessages: AiMessage[];
    wallet: AiWallet;
    onWalletChange: (w: Partial<AiWallet>) => void;
    onConversationId: (id: number, subjectKey: SubjectKey) => void;
    onTitleChange: (title: string) => void;
    onStatusChange?: (status: ChatStatus) => void;
    onOpenHistory: () => void;
    onNewChat: () => void;
    onLeave: () => void;
    studentFirstName?: string;
};

function SubjectSelector({
    subjects,
    activeKey,
    onChange,
    disabled,
}: {
    subjects: AiSubject[];
    activeKey: SubjectKey;
    onChange: (key: SubjectKey) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const active = subjects.find((s) => s.key === activeKey) || subjects[0];

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] text-[12px] font-bold text-[var(--text-primary)] hover:border-[color-mix(in_srgb,var(--color-primary-500)_30%,var(--border))] transition-colors disabled:opacity-50"
                aria-label="انتخاب موضوع"
            >
                <span
                    className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${active?.color || '#8B5CF6'} 18%, transparent)`, color: active?.color }}
                >
                    <SubjectIcon icon={active?.icon} size={12} />
                </span>
                <span className="hidden sm:inline">{active?.nameFa}</span>
                <ChevronDown size={12} className="text-[var(--text-muted)]" />
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            transition={{ duration: 0.16, ease: easeOut }}
                            className="absolute bottom-full mb-2 right-0 z-40 w-44 p-1.5 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] shadow-lg"
                        >
                            {subjects.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => { onChange(s.key); setOpen(false); }}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[12.5px] font-bold text-right transition-colors ${
                                        s.key === activeKey ? 'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)] text-[var(--color-primary-300)]' : 'text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'
                                    }`}
                                >
                                    <span
                                        className="w-6 h-6 rounded-full inline-flex items-center justify-center shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}
                                    >
                                        <SubjectIcon icon={s.icon} size={13} />
                                    </span>
                                    {s.nameFa}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export function ChatScreen({
    subjects,
    activeSubjectKey,
    onSubjectChange,
    conversationId,
    conversationTitle,
    initialMessages,
    wallet,
    onWalletChange,
    onConversationId,
    onTitleChange,
    onStatusChange,
    onOpenHistory,
    onNewChat,
    onLeave,
    studentFirstName,
}: Props) {
    const isMobile = useIsMobile();
    const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<ChatStatus>('ready');
    const [pendingImage, setPendingImage] = useState<AiAttachment | null>(null);
    const [uploading, setUploading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const metRef = useRef<MetHandle>(null);
    const statusRef = useRef<ChatStatus>('ready');
    const lowWarnedRef = useRef(false);

    const updateStatus = (next: ChatStatus) => {
        statusRef.current = next;
        setStatus(next);
        onStatusChange?.(next);
    };

    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, status]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(140, el.scrollHeight)}px`;
    }, [input]);

    const busy = status === 'sending' || status === 'thinking' || status === 'generating';
    const showTyping =
        (status === 'thinking' || status === 'generating') &&
        messages.some((m) => m.streaming && !m.content);

    const energyEmptyNote = () => {
        let refill = 'نیمه‌شب';
        if (wallet.nextRefillAt) {
            try {
                refill = new Date(wallet.nextRefillAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            } catch { /* keep fallback */ }
        }
        return `انرژی امروزت تمام شده — تا ${refill} صبر کن تا سهمیه‌ات برگردد، بعد ادامه می‌دهیم.`;
    };

    const pushLocalNote = (content: string) => {
        setMessages((prev) => [
            ...prev,
            { id: `local-note-${Date.now()}`, role: 'assistant', content, createdAt: new Date().toISOString() },
        ]);
    };

    const handlePickImage = () => fileInputRef.current?.click();

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const { url, mimeType } = await aiTeacherApi.uploadImage(file);
            setPendingImage({ type: 'image', url, mimeType });
        } catch (err: any) {
            pushLocalNote(err?.message || 'آپلود تصویر ناموفق بود.');
        } finally {
            setUploading(false);
        }
    };

    const send = async (preset?: string) => {
        const text = (preset ?? input).trim();
        const attachments = pendingImage ? [pendingImage] : [];
        if (!text && !attachments.length) return;
        if (busy) return;
        if ((wallet.balance || 0) < 1) {
            if (!preset) setInput('');
            pushLocalNote(energyEmptyNote());
            return;
        }

        if (!preset) setInput('');
        setPendingImage(null);
        updateStatus('sending');

        const tempUserId = `local-user-${Date.now()}`;
        const tempAssistantId = `local-assistant-${Date.now()}`;
        const now = new Date().toISOString();

        setMessages((prev) => [
            ...prev,
            { id: tempUserId, role: 'user', content: text, attachments, createdAt: now },
            { id: tempAssistantId, role: 'assistant', content: '', streaming: true, createdAt: now },
        ]);

        const controller = new AbortController();
        abortRef.current = controller;
        let finishedOk = false;

        try {
            await aiTeacherApi.streamChat(
                { conversationId, subjectKey: activeSubjectKey, message: text, attachments },
                {
                    signal: controller.signal,
                    onEvent: (event, data) => {
                        if (event === 'status') {
                            if (data.status === 'thinking') updateStatus('thinking');
                            if (data.status === 'generating') updateStatus('generating');
                            if (data.status === 'ready') { finishedOk = true; updateStatus('ready'); }
                            if (typeof data.balance === 'number') onWalletChange({ balance: data.balance });
                        }
                        if (event === 'meta' && data.conversationId) {
                            onConversationId(data.conversationId, data.subjectKey || activeSubjectKey);
                        }
                        if (event === 'user_message' && data.id) {
                            setMessages((prev) => prev.map((m) => (m.id === tempUserId ? { ...m, id: data.id } : m)));
                        }
                        if (event === 'delta' && data.text) {
                            updateStatus('generating');
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId ? { ...m, content: (m.content || '') + data.text, streaming: true } : m
                                )
                            );
                        }
                        if (event === 'done' && data.message) {
                            finishedOk = true;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId ? { ...data.message, streaming: false, createdAt: data.message.createdAt || now } : m
                                )
                            );
                            if (data.wallet) onWalletChange({ balance: data.wallet.balance });
                            if (data.title) onTitleChange(data.title);
                            const nextBal = data.wallet?.balance;
                            const allowance = wallet.dailyAllowance || 80;
                            const lowMark = Math.max(15, Math.round(allowance * 0.12));
                            if (typeof nextBal === 'number' && nextBal > 0 && nextBal <= lowMark && !lowWarnedRef.current) {
                                lowWarnedRef.current = true;
                                setTimeout(() => pushLocalNote('انرژی‌ات کم شده — امروز سؤال‌هایت را گزیده بپرس تا سهمیه تمام نشود.'), 400);
                            }
                            updateStatus('ready');
                        }
                        if (event === 'error') {
                            updateStatus('error');
                            const refunded = Number(data.refunded) || 0;
                            const note =
                                data.code === 'INSUFFICIENT_COINS'
                                    ? energyEmptyNote()
                                    : refunded > 0
                                        ? `این بار نتوانستم جواب بدهم. انرژی این پیام (${refunded.toLocaleString('fa-IR')}) به حسابت برگشت. دوباره بپرس.`
                                        : 'این بار نتوانستم جواب بدهم. دوباره بپرس.';
                            setMessages((prev) => {
                                let next = prev.filter((m) => m.id !== tempAssistantId);
                                if (data.code === 'INSUFFICIENT_COINS') next = next.filter((m) => m.id !== tempUserId);
                                next.push({ id: `local-note-${Date.now()}`, role: 'assistant', content: note, createdAt: new Date().toISOString() });
                                return next;
                            });
                            if (data.code === 'INSUFFICIENT_COINS' && !preset) setInput(text);
                            if (typeof data.balance === 'number') onWalletChange({ balance: data.balance });
                        }
                    },
                }
            );
            if (!finishedOk && statusRef.current !== 'error') updateStatus('ready');
        } catch {
            updateStatus('error');
            setMessages((prev) => {
                const next = prev.filter((m) => m.id !== tempAssistantId && m.id !== tempUserId);
                next.push({ id: `local-note-${Date.now()}`, role: 'assistant', content: 'پیام نرسید. اگر انرژی کم شده باشد به حسابت برمی‌گردد — دوباره بفرست.', createdAt: new Date().toISOString() });
                return next;
            });
            if (!preset) setInput(text);
        } finally {
            abortRef.current = null;
            setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
            if (['sending', 'thinking', 'generating'].includes(statusRef.current)) updateStatus('ready');
        }
    };

    const visibleMessages = messages.filter((m) => !(m.streaming && !m.content));
    const isFreshChat = visibleMessages.length === 0;
    const suggestions = SUBJECT_SUGGESTIONS[activeSubjectKey] || [];

    const energy = (
        <EnergyMeter balance={wallet.balance || 0} dailyAllowance={wallet.dailyAllowance || 80} nextRefillAt={wallet.nextRefillAt} size={isMobile ? 26 : 30} />
    );

    return (
        <AiPageShell>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileSelected} />

            {/* Mobile header — hero when fresh, compact status bar once a conversation exists */}
            {isMobile && !isFreshChat && (
                <header className="absolute top-0 inset-x-0 z-20 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} dir="ltr">
                    <div className="h-[4.25rem] px-3 flex items-center justify-between gap-2 pointer-events-auto">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                                <Met ref={metRef} size="100%" state={chatStatusToMetState(status)} interactive={false} atmosphere={false} />
                            </div>
                            {energy}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" dir="rtl">
                            <button type="button" onClick={onNewChat} aria-label="گفتگوی جدید" className="p-2 text-[var(--text-primary)] hover:opacity-70">
                                <Plus size={18} />
                            </button>
                            <button type="button" onClick={onOpenHistory} aria-label="تاریخچه" className="p-2 text-[var(--text-primary)] hover:opacity-70">
                                <HistoryIcon size={18} />
                            </button>
                            <button type="button" onClick={onLeave} aria-label="خروج" className="p-2 text-[var(--text-primary)] hover:opacity-70">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Desktop chrome */}
            {!isMobile && (
                <header className="pointer-events-none absolute inset-x-0 top-0 z-20">
                    <div className="pointer-events-auto flex h-[4.5rem] items-center justify-between px-6">
                        <div className="min-w-0 text-right" dir="rtl">
                            <p className="truncate text-sm font-black text-[var(--text-primary)]">
                                {conversationTitle || 'گفتگوی جدید'}
                            </p>
                        </div>
                        <div>{energy}</div>
                    </div>
                </header>
            )}

            <ChatScroll
                topFade={!isFreshChat}
                contentClassName={`px-3 sm:px-6 lg:px-10 py-3 w-full mx-auto ${
                    isMobile ? `max-w-[760px] ${isFreshChat ? 'pt-4' : 'pt-[6.25rem]'}` : 'max-w-[1100px] pt-[5.5rem]'
                }`}
            >
                {isFreshChat && !showTyping ? (
                    <EmptyIntro
                        subjects={subjects}
                        activeSubjectKey={activeSubjectKey}
                        onSubjectChange={onSubjectChange}
                        firstName={studentFirstName}
                        onSuggest={(t) => send(t)}
                        disabled={busy}
                        suggestions={suggestions}
                    />
                ) : (
                    <>
                        {visibleMessages.map((m, i) => {
                            const prev = visibleMessages[i - 1];
                            const next = visibleMessages[i + 1];
                            return (
                                <MessageBubble
                                    key={String(m.id)}
                                    message={m}
                                    isGroupStart={!prev || prev.role !== m.role}
                                    isGroupEnd={!next || next.role !== m.role}
                                />
                            );
                        })}

                        <AnimatePresence>
                            {showTyping && (
                                <motion.div className="flex justify-end gap-2.5 mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <TypingIndicator />
                                    <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-[var(--border)] self-end">
                                        <Met size="100%" initialState="idle" interactive={false} atmosphere={false} reducedMotion />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
                <div ref={bottomRef} className="h-3" />
            </ChatScroll>

            {/* Composer */}
            <div className="shrink-0 px-3 sm:px-5 pt-2" style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}>
                {pendingImage && (
                    <div className="max-w-[900px] mx-auto mb-2 flex items-center gap-2 px-1">
                        <div className="relative w-14 h-14 rounded-[10px] overflow-hidden border border-[var(--border)]">
                            <img src={pendingImage.url} alt="" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => setPendingImage(null)}
                                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/60 text-white inline-flex items-center justify-center"
                                aria-label="حذف تصویر"
                            >
                                <X size={11} />
                            </button>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)]">تصویر آماده ارسال</span>
                    </div>
                )}

                <div className="flex items-center gap-2 max-w-[900px] mx-auto mb-1.5 px-1">
                    <SubjectSelector subjects={subjects} activeKey={activeSubjectKey} onChange={onSubjectChange} disabled={busy} />
                    <button
                        type="button"
                        onClick={handlePickImage}
                        disabled={busy || uploading}
                        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] text-[12px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                        aria-label="افزودن تصویر"
                    >
                        <ImagePlus size={14} />
                        {uploading && <span className="text-[10px]">در حال آپلود…</span>}
                    </button>
                </div>

                <div className="group relative flex items-end w-full max-w-[900px] mx-auto min-h-[52px] px-2 py-1.5 rounded-[26px] bg-[var(--bg-card)] border border-[var(--border)] transition-all duration-200 focus-within:border-[var(--color-primary-500)]/30 focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.045)]">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            const textarea = e.currentTarget;
                            textarea.style.height = 'auto';
                            textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!busy && (input.trim() || pendingImage)) send();
                            }
                        }}
                        rows={1}
                        disabled={busy}
                        placeholder="پیام خود را بنویسید..."
                        className="flex-1 min-h-[40px] max-h-[140px] resize-none overflow-y-auto bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 px-3 py-2.5 text-[14px] leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/55 scrollbar-none"
                    />

                    <motion.button
                        type="button"
                        onClick={() => send()}
                        disabled={busy || (!input.trim() && !pendingImage)}
                        whileTap={(input.trim() || pendingImage) && !busy ? { scale: 0.88 } : undefined}
                        animate={{ scale: (input.trim() || pendingImage) && !busy ? 1 : 0.92, opacity: (input.trim() || pendingImage) && !busy ? 1 : 0.4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        aria-label="ارسال پیام"
                        className={`shrink-0 p-0 w-9 h-9 mb-0.5 rounded-full flex items-center justify-center transition-all duration-200 ${
                            (input.trim() || pendingImage) && !busy
                                ? 'bg-[var(--color-primary-500)] text-white shadow-[0_2px_10px_rgba(124,58,237,0.18)] hover:bg-[var(--color-primary-600)]'
                                : 'bg-[var(--text-primary)]/[0.045] text-[var(--text-muted)]/50'
                        } disabled:cursor-not-allowed`}
                    >
                        <Send size={17} strokeWidth={2.2} className="-translate-x-[1px]" />
                    </motion.button>
                </div>
            </div>
        </AiPageShell>
    );
}

function EmptyIntro({
    subjects,
    activeSubjectKey,
    onSubjectChange,
    firstName,
    onSuggest,
    disabled,
    suggestions,
}: {
    subjects: AiSubject[];
    activeSubjectKey: SubjectKey;
    onSubjectChange: (key: SubjectKey) => void;
    firstName?: string;
    onSuggest: (text: string) => void;
    disabled?: boolean;
    suggestions: Suggestion[];
}) {
    const name = firstName || 'دوست من';
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="min-h-[55vh] flex flex-col items-center justify-center text-center px-4"
        >
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[var(--border)] mb-4">
                <Met size="100%" initialState="idle" mood="happy" interactive energy={0.6} />
            </div>
            <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">سلام {name}</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-7 max-w-sm">
                من Met ام. یک موضوع رو انتخاب کن تا دقیق همون‌جوری که بلدی باهات همراه شوم.
            </p>

            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap max-w-md">
                {subjects.map((s) => {
                    const active = s.key === activeSubjectKey;
                    return (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => onSubjectChange(s.key)}
                            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-bold transition-colors ${
                                active
                                    ? 'border-[color-mix(in_srgb,var(--color-primary-500)_45%,var(--border))] bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)] text-[var(--color-primary-300)]'
                                    : 'border-[var(--border)]/80 text-[var(--text-secondary)] hover:border-[color-mix(in_srgb,var(--color-primary-500)_25%,var(--border))]'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full inline-flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}>
                                <SubjectIcon icon={s.icon} size={12} />
                            </span>
                            {s.nameFa}
                        </button>
                    );
                })}
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
                {suggestions.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <motion.button
                            key={s.title}
                            type="button"
                            disabled={disabled}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 + i * 0.05, duration: 0.28, ease: easeOut }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onSuggest(s.text)}
                            className="flex items-center gap-2.5 text-right px-3.5 py-3.5 rounded-[16px] border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--text-primary)_2.5%,var(--bg-card))] hover:border-[color-mix(in_srgb,var(--color-primary-500)_30%,var(--border))] hover:bg-[color-mix(in_srgb,var(--color-primary-500)_6%,var(--bg-card))] shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-colors disabled:opacity-50"
                        >
                            <span className="w-9 h-9 rounded-[12px] bg-[color-mix(in_srgb,var(--color-primary-500)_12%,transparent)] text-[var(--color-primary-400)] inline-flex items-center justify-center shrink-0">
                                <Icon size={16} />
                            </span>
                            <span className="min-w-0 text-right">
                                <span className="block text-[13px] font-black text-[var(--text-primary)]">{s.title}</span>
                                <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">{s.hint}</span>
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </motion.div>
    );
}
