import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Send, ImagePlus, X, LogOut, History as HistoryIcon, Plus, Mic, ArrowRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import type { AiAttachment, AiMessage, AiSubject, AiWallet, ChatStatus, SubjectKey } from './types';
import { MessageBubble } from './MessageBubble';
import { aiTeacherApi } from './api';
import { Met, chatStatusToMetState, subjectToMetColor } from '../../components/met';
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
    voiceEnabled?: boolean;
    voiceRepliesEnabled?: boolean;
    studentFirstName?: string;
};

/** Compact icon-only subject picker that lives inside the composer bar. */
function ComposerSubjectSelect({
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
        <div className="relative shrink-0 self-end mb-1">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                className="w-9 h-9 rounded-full inline-flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: `color-mix(in srgb, ${active?.color || '#8B5CF6'} 16%, transparent)`, color: active?.color }}
                aria-label={`موضوع: ${active?.nameFa}`}
                title={active?.nameFa}
            >
                <SubjectIcon icon={active?.icon} size={16} />
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

/**
 * Corner subject wheel (mobile, active chat): Met sits like a wheel in the
 * top-left corner; tapping spins it to the next subject color.
 */
function CornerSubjectWheel({
    subjects,
    activeKey,
    onChange,
    status,
}: {
    subjects: AiSubject[];
    activeKey: SubjectKey;
    onChange: (key: SubjectKey) => void;
    status: ChatStatus;
}) {
    const [spin, setSpin] = useState(0);
    const activeIndex = Math.max(0, subjects.findIndex((s) => s.key === activeKey));
    const active = subjects[activeIndex];

    const next = () => {
        setSpin((v) => v + 1);
        onChange(subjects[(activeIndex + 1) % subjects.length].key);
    };

    return (
        <button
            type="button"
            onClick={next}
            aria-label={`تغییر موضوع — فعلی: ${active?.nameFa}`}
            className="absolute -top-6 -left-6 w-[92px] h-[92px] p-0 border-0 bg-transparent"
            style={{ touchAction: 'manipulation' }}
        >
            <motion.span
                className="absolute inset-0 rounded-full border border-dashed"
                style={{ borderColor: `color-mix(in srgb, ${active?.color || '#8B5CF6'} 45%, transparent)` }}
                animate={{ rotate: spin * 90 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            />
            <motion.span
                className="absolute inset-[7px] block"
                animate={{ rotate: spin * 90 }}
                transition={{ type: 'spring', stiffness: 180, damping: 20 }}
                style={{ transformOrigin: '50% 50%' }}
            >
                <motion.span className="block w-full h-full" animate={{ rotate: spin * -90 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}>
                    <Met
                        size="100%"
                        color={subjectToMetColor(activeKey)}
                        state={chatStatusToMetState(status)}
                        interactive={false}
                        atmosphere={false}
                    />
                </motion.span>
            </motion.span>
            <span
                className="absolute bottom-1 left-1/2 -translate-x-1/2 translate-y-full mt-1 text-[9px] font-black whitespace-nowrap"
                style={{ color: active?.color }}
            >
                {active?.nameFa}
            </span>
        </button>
    );
}

/** Same minimal ghost style for every mobile header action. */
function HeaderIconButton({
    onClick,
    label,
    children,
}: {
    onClick: () => void;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="w-8 h-8 rounded-full inline-flex items-center justify-center border border-[var(--border)]/60 bg-[color-mix(in_srgb,var(--bg-card)_72%,transparent)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all backdrop-blur-sm"
        >
            {children}
        </button>
    );
}

type RecState = 'idle' | 'recording' | 'transcribing';

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
    voiceEnabled = true,
    voiceRepliesEnabled = true,
    studentFirstName,
}: Props) {
    const isMobile = useIsMobile();
    const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<ChatStatus>('ready');
    const [pendingImage, setPendingImage] = useState<AiAttachment | null>(null);
    const [uploading, setUploading] = useState(false);
    const [recState, setRecState] = useState<RecState>('idle');
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const statusRef = useRef<ChatStatus>('ready');
    const lowWarnedRef = useRef(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const metColor = subjectToMetColor(activeSubjectKey);

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

    // Stop any live recording when the screen unmounts.
    useEffect(() => () => {
        try { recorderRef.current?.stop(); } catch { /* ignore */ }
        if (recTimerRef.current) clearTimeout(recTimerRef.current);
    }, []);

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

    // ─── Voice input (mic → STT → auto-send) ─────────────────────────────────
    const stopRecording = useCallback(() => {
        try { recorderRef.current?.stop(); } catch { /* ignore */ }
        if (recTimerRef.current) { clearTimeout(recTimerRef.current); recTimerRef.current = null; }
    }, []);

    const startRecording = async () => {
        if (recState !== 'idle' || busy) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : undefined;
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                recorderRef.current = null;
                const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                if (blob.size < 1200) { setRecState('idle'); return; }
                setRecState('transcribing');
                try {
                    const res = await aiTeacherApi.transcribeVoice(blob);
                    if (typeof res.balance === 'number') onWalletChange({ balance: res.balance });
                    setRecState('idle');
                    if (res.text) void send(res.text);
                } catch (err: any) {
                    setRecState('idle');
                    toast.error(err?.message || 'تبدیل صدا ناموفق بود');
                }
            };
            recorderRef.current = recorder;
            recorder.start();
            setRecState('recording');
            recTimerRef.current = setTimeout(stopRecording, 60_000);
        } catch {
            toast.error('دسترسی به میکروفون ممکن نشد');
        }
    };

    const toggleRecording = () => {
        if (recState === 'recording') stopRecording();
        else void startRecording();
    };

    // ─── TTS for assistant replies ───────────────────────────────────────────
    const handleSpeak = async (messageId: number): Promise<string | null> => {
        const res = await aiTeacherApi.speakMessage(messageId);
        if (typeof res.data.balance === 'number') onWalletChange({ balance: res.data.balance });
        // Cache the URL on the message so replays skip the API entirely.
        setMessages((prev) =>
            prev.map((m) =>
                m.id === messageId
                    ? { ...m, attachments: [...(m.attachments || []).filter((a) => a.type !== 'audio'), { type: 'audio', url: res.data.url }] }
                    : m
            )
        );
        return res.data.url;
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
    const canSend = (input.trim().length > 0 || !!pendingImage) && !busy && recState === 'idle';

    const energy = (
        <EnergyMeter balance={wallet.balance || 0} dailyAllowance={wallet.dailyAllowance || 80} nextRefillAt={wallet.nextRefillAt} size={isMobile ? 26 : 30} />
    );

    return (
        <AiPageShell>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileSelected} />

            {/* Mobile header — two different layouts: fresh chat vs. active chat */}
            {isMobile && (
                <header className="absolute top-0 inset-x-0 z-20 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} dir="ltr">
                    {isFreshChat ? (
                        <div className="h-14 px-3 flex items-center justify-between pointer-events-auto">
                            <button
                                type="button"
                                onClick={onLeave}
                                className="inline-flex items-center gap-1 h-8 pl-1.5 pr-3 rounded-full text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                aria-label="بازگشت"
                            >
                                <ArrowRight size={15} className="rotate-180" />
                                بازگشت
                            </button>
                            <HeaderIconButton onClick={onOpenHistory} label="تاریخچه">
                                <HistoryIcon size={15} />
                            </HeaderIconButton>
                        </div>
                    ) : (
                        <div className="relative h-16 pointer-events-auto">
                            <CornerSubjectWheel
                                subjects={subjects}
                                activeKey={activeSubjectKey}
                                onChange={onSubjectChange}
                                status={status}
                            />
                            <div className="absolute top-3.5 left-1/2 -translate-x-1/2">{energy}</div>
                            <div className="absolute top-3.5 right-3 flex items-center gap-1.5" dir="rtl">
                                <HeaderIconButton onClick={onLeave} label="خروج">
                                    <LogOut size={14} />
                                </HeaderIconButton>
                                <HeaderIconButton onClick={onNewChat} label="گفتگوی جدید">
                                    <Plus size={15} />
                                </HeaderIconButton>
                                <HeaderIconButton onClick={onOpenHistory} label="تاریخچه">
                                    <HistoryIcon size={14} />
                                </HeaderIconButton>
                            </div>
                        </div>
                    )}
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
                    isMobile ? `max-w-[760px] ${isFreshChat ? 'pt-14' : 'pt-[5.25rem]'}` : 'max-w-[1100px] pt-[5rem]'
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
                        isMobile={isMobile}
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
                                    metColor={metColor}
                                    canSpeak={voiceEnabled && voiceRepliesEnabled}
                                    onSpeak={handleSpeak}
                                    isGroupStart={!prev || prev.role !== m.role}
                                    isGroupEnd={!next || next.role !== m.role}
                                />
                            );
                        })}

                        <AnimatePresence>
                            {showTyping && (
                                <motion.div className="flex justify-end gap-2.5 mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <TypingIndicator />
                                    <div className="w-8 h-8 self-end">
                                        <Met size="100%" initialState="idle" color={metColor} interactive={false} atmosphere={false} reducedMotion />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
                <div ref={bottomRef} className="h-3" />
            </ChatScroll>

            {/* Composer — subject select (right), textarea, mic + image + send (left) */}
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

                <div className="group relative flex items-end gap-1 w-full max-w-[900px] mx-auto min-h-[52px] px-2 py-1.5 rounded-[26px] bg-[var(--bg-card)] border border-[var(--border)] transition-all duration-200 focus-within:border-[var(--color-primary-500)]/30 focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.045)]">
                    <ComposerSubjectSelect
                        subjects={subjects}
                        activeKey={activeSubjectKey}
                        onChange={onSubjectChange}
                        disabled={busy || recState !== 'idle'}
                    />

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
                                if (canSend) send();
                            }
                        }}
                        rows={1}
                        disabled={busy || recState === 'transcribing'}
                        placeholder={
                            recState === 'recording' ? 'در حال ضبط… دوباره بزن تا ارسال شود'
                                : recState === 'transcribing' ? 'در حال تبدیل صدا…'
                                : 'پیام خود را بنویسید...'
                        }
                        className="flex-1 min-h-[40px] max-h-[140px] resize-none overflow-y-auto bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 px-2 py-2.5 text-[14px] leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/55 scrollbar-none"
                    />

                    {voiceEnabled && (
                        <button
                            type="button"
                            onClick={toggleRecording}
                            disabled={busy || recState === 'transcribing'}
                            aria-label={recState === 'recording' ? 'پایان ضبط' : 'پیام صوتی'}
                            className={`shrink-0 self-end mb-1 w-9 h-9 rounded-full inline-flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 ${
                                recState === 'recording'
                                    ? 'bg-rose-500 text-white animate-pulse'
                                    : recState === 'transcribing'
                                        ? 'bg-[var(--text-primary)]/[0.06] text-[var(--text-muted)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.05]'
                            }`}
                        >
                            <Mic size={16} />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handlePickImage}
                        disabled={busy || uploading || recState !== 'idle'}
                        aria-label="افزودن تصویر"
                        className={`shrink-0 self-end mb-1 w-9 h-9 rounded-full inline-flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 ${
                            uploading
                                ? 'bg-[var(--text-primary)]/[0.06] text-[var(--color-primary-400)] animate-pulse'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.05]'
                        }`}
                    >
                        <ImagePlus size={16} />
                    </button>

                    <motion.button
                        type="button"
                        onClick={() => send()}
                        disabled={!canSend}
                        whileTap={canSend ? { scale: 0.88 } : undefined}
                        animate={{ scale: canSend ? 1 : 0.92, opacity: canSend ? 1 : 0.4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        aria-label="ارسال پیام"
                        className={`shrink-0 p-0 w-9 h-9 mb-1 self-end rounded-full flex items-center justify-center transition-all duration-200 ${
                            canSend
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
    isMobile,
}: {
    subjects: AiSubject[];
    activeSubjectKey: SubjectKey;
    onSubjectChange: (key: SubjectKey) => void;
    firstName?: string;
    onSuggest: (text: string) => void;
    disabled?: boolean;
    suggestions: Suggestion[];
    isMobile?: boolean;
}) {
    const name = firstName || 'دوست من';
    const active = subjects.find((s) => s.key === activeSubjectKey);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="min-h-[55vh] flex flex-col items-center justify-center text-center px-4"
        >
            <div className={`${isMobile ? 'w-44 h-44' : 'w-36 h-36'} mb-3`}>
                <Met size="100%" initialState="happy" color={subjectToMetColor(activeSubjectKey)} mood="happy" interactive energy={0.6} />
            </div>
            <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">سلام {name} 👋</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-7 max-w-sm">
                من «مِت» هستم — همراهِ {active?.nameFa || 'درس'}. از همین‌جا بپرس؛ عکس بفرست، صدا بفرست، یا یکی از این‌ها را انتخاب کن.
            </p>

            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap max-w-md">
                {subjects.map((s) => {
                    const isActive = s.key === activeSubjectKey;
                    return (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => onSubjectChange(s.key)}
                            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[12px] font-bold transition-all ${
                                isActive ? 'text-white border-transparent' : 'border-[var(--border)]/80 text-[var(--text-secondary)]'
                            }`}
                            style={isActive ? { background: s.color } : undefined}
                        >
                            <SubjectIcon icon={s.icon} size={12} />
                            {s.nameFa}
                        </button>
                    );
                })}
            </div>

            {isMobile ? (
                /* Minimal chips on mobile — no cards, no hint text */
                <div className="mt-6 flex flex-wrap justify-center gap-1.5 w-full max-w-sm">
                    {suggestions.map((s) => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.title}
                                type="button"
                                disabled={disabled}
                                onClick={() => onSuggest(s.text)}
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--text-primary)_2.5%,var(--bg-card))] text-[12px] font-bold text-[var(--text-secondary)] active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Icon size={13} className="text-[var(--color-primary-400)]" />
                                {s.title}
                            </button>
                        );
                    })}
                </div>
            ) : (
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
            )}
        </motion.div>
    );
}
