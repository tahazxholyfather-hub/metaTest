import React, { useEffect, useRef, useState } from 'react';
import {
    MoreVertical, Send, ArrowRight, BookOpen, Lightbulb,
    Target, GraduationCap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AiMessage, AiTeacherPublic, AiWallet, ChatStatus } from './types';
import { MessageBubble } from './MessageBubble';
import { aiTeacherApi } from './api';
import { SHORT_WORKING_LABELS } from './TeacherSidebar';
import {
    AiPageShell,
    ChatScroll,
    ChatStatusLine,
    EnergyMeter,
    TypingIndicator,
    easeOut,
    useIsMobile,
} from './ui';

type Props = {
    teacher: AiTeacherPublic;
    conversationId: number | null;
    initialMessages: AiMessage[];
    wallet: AiWallet;
    onWalletChange: (w: Partial<AiWallet>) => void;
    onConversationId: (id: number) => void;
    onStatusChange?: (status: ChatStatus) => void;
    onOpenMenu: () => void;
    onBack: () => void;
    studentFirstName?: string;
};

const SUGGESTIONS = [
    {
        icon: Lightbulb,
        title: 'بسنج سطح من',
        hint: 'یک سؤال مفهومی',
        text: 'یک سؤال مفهومی بپرس تا سطح من را بسنجی.',
    },
    {
        icon: BookOpen,
        title: 'درس بده',
        hint: 'قدم‌به‌قدم و با مثال',
        text: 'یک مبحث مهم را از صفر، قدم‌به‌قدم و با مثال برایم درس بده.',
    },
    {
        icon: Target,
        title: 'تمرین کنیم',
        hint: 'از آسان تا سخت',
        text: 'چند تمرین از آسان تا سخت برایم بنویس و منتظر جوابم بمان.',
    },
    {
        icon: GraduationCap,
        title: 'آزمونک',
        hint: 'شبیه امتحان کوتاه',
        text: 'مثل یک امتحان کوتاه ازم آزمون بگیر و بعد نمره‌ام را بده.',
    },
];

export function ChatScreen({
    teacher,
    conversationId,
    initialMessages,
    wallet,
    onWalletChange,
    onConversationId,
    onStatusChange,
    onOpenMenu,
    onBack,
    studentFirstName,
}: Props) {
    const isMobile = useIsMobile();
    const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<ChatStatus>('ready');
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    const teacherName = teacher.displayName || 'معلم';

    const energyEmptyNote = () => {
        let refill = 'نیمه‌شب';
        if (wallet.nextRefillAt) {
            try {
                refill = new Date(wallet.nextRefillAt).toLocaleTimeString('fa-IR', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
            } catch { /* keep fallback */ }
        }
        return `${teacherName} هستم. انرژی امروزت تمام شده، پس فعلاً درس نمی‌دم. تا ${refill} صبر کن تا سهمیه‌ات برگردد — بعد با هم ادامه می‌دهیم.`;
    };

    const pushLocalTeacherNote = (content: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `local-note-${Date.now()}`,
                role: 'assistant',
                content,
                createdAt: new Date().toISOString(),
            },
        ]);
    };

    const send = async (preset?: string) => {
        const text = (preset ?? input).trim();
        if (!text || busy) return;
        if ((wallet.balance || 0) < 1) {
            if (!preset) setInput('');
            pushLocalTeacherNote(energyEmptyNote());
            return;
        }
        const typical = Number(teacher.typicalEnergy || teacher.pricePerMessage || 0);
        if (typical > 0 && (wallet.balance || 0) < typical) {
            pushLocalTeacherNote(
                `${teacherName} هستم. برای این کلاس حدود ${typical.toLocaleString('fa-IR')} انرژی لازم است و سهمیه امروزت به آن نمی‌رسد. معلم دیگری را امتحان کن یا تا شارژ بعدی صبر کن.`
            );
            return;
        }

        if (!preset) setInput('');
        updateStatus('sending');

        const tempUserId = `local-user-${Date.now()}`;
        const tempAssistantId = `local-assistant-${Date.now()}`;
        const now = new Date().toISOString();

        setMessages((prev) => [
            ...prev,
            { id: tempUserId, role: 'user', content: text, createdAt: now },
            { id: tempAssistantId, role: 'assistant', content: '', streaming: true, createdAt: now },
        ]);

        const controller = new AbortController();
        abortRef.current = controller;
        let finishedOk = false;

        try {
            await aiTeacherApi.streamChat(
                { conversationId, message: text },
                {
                    signal: controller.signal,
                    onEvent: (event, data) => {
                        if (event === 'status') {
                            if (data.status === 'thinking') updateStatus('thinking');
                            if (data.status === 'generating') updateStatus('generating');
                            if (data.status === 'ready') {
                                finishedOk = true;
                                updateStatus('ready');
                            }
                            if (typeof data.balance === 'number') onWalletChange({ balance: data.balance });
                        }
                        if (event === 'meta' && data.conversationId) onConversationId(data.conversationId);
                        if (event === 'user_message' && data.id) {
                            setMessages((prev) => prev.map((m) => (m.id === tempUserId ? { ...m, id: data.id } : m)));
                        }
                        if (event === 'delta' && data.text) {
                            updateStatus('generating');
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId
                                        ? { ...m, content: (m.content || '') + data.text, streaming: true }
                                        : m
                                )
                            );
                        }
                        if (event === 'done' && data.message) {
                            finishedOk = true;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId
                                        ? { ...data.message, streaming: false, createdAt: data.message.createdAt || now }
                                        : m
                                )
                            );
                            if (data.wallet) onWalletChange({ balance: data.wallet.balance });
                            const nextBal = data.wallet?.balance;
                            const allowance = wallet.dailyAllowance || 80;
                            const lowMark = Math.max(15, Math.round(allowance * 0.12));
                            if (typeof nextBal === 'number' && nextBal > 0 && nextBal <= lowMark && !lowWarnedRef.current) {
                                lowWarnedRef.current = true;
                                setTimeout(() => {
                                    pushLocalTeacherNote(
                                        `${teacherName} هستم. انرژی‌ات کم شده — امروز سؤال‌هایت را گزیده بپرس تا سهمیه تمام نشود.`
                                    );
                                }, 400);
                            }
                            updateStatus('ready');
                        }
                        if (event === 'error') {
                            updateStatus('error');
                            const refunded = Number(data.refunded) || 0;
                            const note =
                                data.code === 'INSUFFICIENT_COINS'
                                    ? energyEmptyNote()
                                    : data.code === 'TEACHER_REQUIRES_PRO'
                                      ? `${teacherName} هستم. این کلاس برای کاربران ویژه است. معلم رایگان را انتخاب کن یا اشتراکت را ارتقا بده.`
                                    : refunded > 0
                                      ? `${teacherName} هستم. این بار نتوانستم جواب بدهم. انرژی این پیام (${refunded.toLocaleString('fa-IR')}) به حسابت برگشت. لطفاً دوباره بپرس.`
                                      : `${teacherName} هستم. این بار نتوانستم جواب بدهم. لطفاً دوباره بپرس.`;
                            setMessages((prev) => {
                                let next = prev.filter((m) => m.id !== tempAssistantId);
                                if (data.code === 'INSUFFICIENT_COINS') {
                                    next = next.filter((m) => m.id !== tempUserId);
                                }
                                next.push({
                                    id: `local-note-${Date.now()}`,
                                    role: 'assistant',
                                    content: note,
                                    createdAt: new Date().toISOString(),
                                });
                                return next;
                            });
                            if (data.code === 'INSUFFICIENT_COINS' && !preset) setInput(text);
                            if (typeof data.balance === 'number') onWalletChange({ balance: data.balance });
                        }
                    },
                }
            );
            if (!finishedOk && statusRef.current !== 'error') {
                updateStatus('ready');
            }
        } catch {
            updateStatus('error');
            setMessages((prev) => {
                const next = prev.filter((m) => m.id !== tempAssistantId && m.id !== tempUserId);
                next.push({
                    id: `local-note-${Date.now()}`,
                    role: 'assistant',
                    content: `${teacherName} هستم. پیام نرسید. اگر انرژی کم شده باشد به حسابت برمی‌گردد — دوباره بفرست.`,
                    createdAt: new Date().toISOString(),
                });
                return next;
            });
            if (!preset) setInput(text);
        } finally {
            abortRef.current = null;
            setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
            if (statusRef.current === 'sending' || statusRef.current === 'thinking' || statusRef.current === 'generating') {
                updateStatus('ready');
            }
        }
    };

    const visibleMessages = messages.filter((m) => !(m.streaming && !m.content));
    const isFreshChat = messages.length === 0 || (messages.length === 1 && !!messages[0]?.isStarter);

    const energy = (
        <EnergyMeter
            balance={wallet.balance || 0}
            dailyAllowance={wallet.dailyAllowance || 80}
            nextRefillAt={wallet.nextRefillAt}
            size={isMobile ? 28 : 32}
        />
    );

    return (
        <AiPageShell>
            {/* Mobile header — fade lives on the chat viewport via ChatScroll */}
            {isMobile && (
                <header
                    className="absolute top-0 inset-x-0 z-20 pointer-events-none"
                    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                    dir="ltr"
                >
                    <div className="h-[4.25rem] px-3 flex items-center justify-between gap-2 pointer-events-auto">
                        <div className="flex items-center gap-2 min-w-0">
                            <button
                                type="button"
                                onClick={onBack}
                                aria-label="بازگشت"
                                className="p-2 text-[var(--text-primary)] hover:opacity-70 transition-opacity"
                            >
                                <ArrowRight size={18} className="rotate-180" />
                            </button>
                            <img
                                src={teacher.avatarUrl || '/avatars/user_default.png'}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0 text-left" dir="rtl">
                                <div className="text-[13px] font-extrabold text-[var(--text-primary)] truncate leading-tight">
                                    {teacher.displayName}
                                </div>
                                <ChatStatusLine status={status} workingLabels={SHORT_WORKING_LABELS} />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {energy}
                            <button
                                type="button"
                                onClick={onOpenMenu}
                                aria-label="منو"
                                className="p-2 text-[var(--text-primary)] hover:opacity-70"
                            >
                                <MoreVertical size={18} />
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Desktop chrome sits above the ChatScroll fade layer */}
            {!isMobile && (
                <header className="pointer-events-none absolute inset-x-0 top-0 z-20">
                    <div className="pointer-events-auto flex h-[4.5rem] items-center justify-between px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <img
                                src={teacher.avatarUrl || '/avatars/user_default.png'}
                                alt=""
                                className="w-11 h-11 rounded-full object-cover ring-1 ring-[var(--border)] shrink-0"
                            />
                            <div className="min-w-0 text-right" dir="rtl">
                                <p className="truncate text-sm font-black text-[var(--text-primary)]">
                                    {teacher.displayName}
                                </p>
                                <ChatStatusLine status={status} workingLabels={SHORT_WORKING_LABELS} />
                            </div>
                        </div>
                        <div>{energy}</div>
                    </div>
                </header>
            )}

            <ChatScroll
                topFade
                contentClassName={`px-3 sm:px-6 lg:px-10 py-3 w-full mx-auto ${
                    isMobile ? 'max-w-[760px] pt-[6.25rem]' : 'max-w-[1100px] pt-[5.5rem]'
                }`}
            >
                {visibleMessages.length === 0 && !showTyping ? (
                    <EmptyIntro
                        teacher={teacher}
                        firstName={studentFirstName}
                        onSuggest={(t) => send(t)}
                        disabled={busy}
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
                                    teacherAvatar={teacher.avatarUrl}
                                    teacherName={teacher.displayName}
                                    isGroupStart={!prev || prev.role !== m.role}
                                    isGroupEnd={!next || next.role !== m.role}
                                />
                            );
                        })}

                        <AnimatePresence>
                            {showTyping && (
                                <motion.div
                                    className="flex justify-end gap-2.5 mt-4"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <TypingIndicator />
                                    <img
                                        src={teacher.avatarUrl || '/avatars/user_default.png'}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover ring-1 ring-[var(--border)] self-end"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {isFreshChat && visibleMessages.length > 0 && !busy && (
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto px-1">
                                {SUGGESTIONS.map((s) => {
                                    const Icon = s.icon;
                                    return (
                                        <button
                                            key={s.title}
                                            type="button"
                                            onClick={() => send(s.text)}
                                            className="flex items-center gap-2.5 text-right px-3.5 py-3 rounded-[14px] border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--text-primary)_2.5%,var(--bg-card))] hover:border-[color-mix(in_srgb,var(--color-primary-500)_30%,var(--border))] hover:bg-[color-mix(in_srgb,var(--color-primary-500)_6%,var(--bg-card))] transition-colors"
                                        >
                                            <span className="w-8 h-8 rounded-[10px] bg-[color-mix(in_srgb,var(--color-primary-500)_12%,transparent)] text-[var(--color-primary-400)] inline-flex items-center justify-center shrink-0">
                                                <Icon size={15} />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[12.5px] font-bold text-[var(--text-primary)]">{s.title}</span>
                                                <span className="block text-[10.5px] text-[var(--text-muted)] mt-0.5">{s.hint}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
                <div ref={bottomRef} className="h-3" />
            </ChatScroll>
            {/* Composer */}
            <div
                className="shrink-0 px-3 sm:px-5 pt-2.5"
                style={{
                    paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))',
                }}
            >
                <div
                    className="
            group
            relative
            flex
            items-end
            w-full
            max-w-[900px]
            mx-auto
            min-h-[52px]
            px-2
            py-1.5
            rounded-[26px]
            bg-[var(--bg-card)]
            border
            border-[var(--border)]
            transition-all
            duration-200
            focus-within:border-[var(--color-primary-500)]/30
            focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.045)]
        "
                >
        <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
                setInput(e.target.value);

                const textarea = e.currentTarget;

                textarea.style.height = 'auto';
                textarea.style.height = `${Math.min(
                    textarea.scrollHeight,
                    140
                )}px`;
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();

                    if (!busy && input.trim()) {
                        send();
                    }
                }
            }}
            rows={1}
            disabled={busy}
            placeholder="پیام خود را بنویسید..."
            className="
                flex-1
                min-h-[40px]
                max-h-[140px]
                resize-none
                overflow-y-auto
                bg-transparent
                border-0
                outline-none
                ring-0
                focus:outline-none
                focus:ring-0
                px-3
                py-2.5
                text-[14px]
                leading-6
                text-[var(--text-primary)]
                placeholder:text-[var(--text-muted)]/55
                scrollbar-none
            "
        />

                    <motion.button
                        type="button"
                        onClick={send}
                        disabled={busy || !input.trim()}
                        whileTap={
                            input.trim() && !busy
                                ? { scale: 0.88 }
                                : undefined
                        }
                        animate={{
                            scale: input.trim() && !busy ? 1 : 0.92,
                            opacity: input.trim() && !busy ? 1 : 0.4,
                        }}
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                        }}
                        aria-label="ارسال پیام"
                        className={`
                shrink-0
                p-0
                w-9
                h-9
                mb-0.5
                rounded-full
                flex
                items-center
                justify-center
                transition-all
                duration-200

                ${
                            input.trim() && !busy
                                ? `
                            bg-[var(--color-primary-500)]
                            text-white
                            shadow-[0_2px_10px_rgba(124,58,237,0.18)]
                            hover:bg-[var(--color-primary-600)]
                        `
                                : `
                            bg-[var(--text-primary)]/[0.045]
                            text-[var(--text-muted)]/50
                        `
                        }

                disabled:cursor-not-allowed
            `}
                    >
                        <Send
                            size={17}
                            strokeWidth={2.2}
                            className="-translate-x-[1px]"
                        />
                    </motion.button>
                </div>
            </div>
        </AiPageShell>
    );
}

function EmptyIntro({
    teacher,
    firstName,
    onSuggest,
    disabled,
}: {
    teacher: AiTeacherPublic;
    firstName?: string;
    onSuggest: (text: string) => void;
    disabled?: boolean;
}) {
    const name = firstName || 'دوست من';
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="min-h-[55vh] flex flex-col items-center justify-center text-center px-4"
        >
            <img
                src={teacher.avatarUrl || '/avatars/user_default.png'}
                alt=""
                className="w-16 h-16 rounded-full object-cover ring-2 ring-[var(--border)] mb-4"
            />
            <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                سلام {name}
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-7 max-w-sm">
                من {teacher.displayName} هستم. آماده‌ام کمکت کنم درس‌ها را بفهمی، تمرین کنی یا برای امتحان آماده شوی.
            </p>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
                {SUGGESTIONS.map((s, i) => {
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
