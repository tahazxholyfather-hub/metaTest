import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ChevronDown, History, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Met, chatStatusToMetState, subjectToMetColor } from '../../components/met';
import { metApi } from './api';
import type { MetFeatures, MetMessage, MetSettings, MetSubject, MetSuggestion, MetWallet, SubjectKey } from './types';
import type { useMetChat } from './useMetChat';
import { Composer, type ComposerHandle } from './Composer';
import Message from './Message';
import { SlugIcon, findSubject } from './subjectIcons';
import { SubjectPicker } from './SubjectPicker';
import type { RailPanel } from './MetRail';
import { CoinChip, GraySpinner, IconButton, TypingDots, WorkingText, easeOut, usePrefersReducedMotion, workingStatusText } from './ui';

type Chat = ReturnType<typeof useMetChat>;

type Props = {
    chat: Chat;
    features: MetFeatures;
    subjects: MetSubject[];
    subjectKey: SubjectKey;
    onSubjectChange: (key: SubjectKey) => void;
    wallet: MetWallet;
    settings: MetSettings;
    studentFirstName?: string | null;
    isMobile: boolean;
    onOpenPanel: (p: RailPanel) => void;
    onNewChat: () => void;
    onSpeak: (messageId: number) => Promise<string | null>;
    onListening: (level: number | null) => void;
    audioLevel: number | null;
    ensureConversation: () => Promise<number>;
    composerRef: React.RefObject<ComposerHandle | null>;
    /** Extra bottom padding (mobile global bottom nav). */
    bottomInset?: string;
};

function greeting(firstName?: string | null) {
    const h = new Date().getHours();
    const part = h < 12 ? 'صبح بخیر' : h < 17 ? 'ظهر بخیر' : h < 21 ? 'عصر بخیر' : 'شب بخیر';
    return firstName ? `${part}، ${firstName}!` : `${part}!`;
}

export function ChatScreen({
    chat,
    features,
    subjects,
    subjectKey,
    onSubjectChange,
    wallet,
    settings,
    studentFirstName,
    isMobile,
    onOpenPanel,
    onNewChat,
    onSpeak,
    onListening,
    audioLevel,
    ensureConversation,
    composerRef,
    bottomInset,
}: Props) {
    const reduce = usePrefersReducedMotion();
    const subject = findSubject(subjects, subjectKey);
    const metColor = subjectToMetColor(subjectKey);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [atBottom, setAtBottom] = useState(true);
    const [suggestions, setSuggestions] = useState<MetSuggestion[]>([]);
    const suggestionCache = useRef<Map<string, MetSuggestion[]>>(new Map());
    const isEmpty = chat.messages.length === 0 && !chat.loading;
    const working = chat.busy;

    /* ── Suggestions for the empty state ─────────────────────────────── */
    useEffect(() => {
        if (!isEmpty || !features.available) return;
        const cached = suggestionCache.current.get(subjectKey);
        if (cached) return setSuggestions(cached);
        let cancelled = false;
        metApi
            .suggestions(subjectKey)
            .then((items) => {
                if (cancelled) return;
                suggestionCache.current.set(subjectKey, items);
                setSuggestions(items);
            })
            .catch(() => !cancelled && setSuggestions([]));
        return () => { cancelled = true; };
    }, [isEmpty, subjectKey, features.available]);

    /* ── Scrolling ───────────────────────────────────────────────────── */
    const scrollToBottom = useCallback((smooth = true) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    }, [reduce]);

    const lastMsg = chat.messages[chat.messages.length - 1];
    const lastLen = lastMsg?.content?.length || 0;
    useLayoutEffect(() => {
        if (atBottom) scrollToBottom(!lastMsg?.streaming);
    }, [chat.messages.length, lastLen, atBottom, scrollToBottom, lastMsg?.streaming]);

    useEffect(() => {
        // Jump on conversation switch.
        const id = requestAnimationFrame(() => {
            scrollToBottom(false);
            setAtBottom(true);
        });
        return () => cancelAnimationFrame(id);
    }, [chat.conversation?.id, scrollToBottom]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
        setAtBottom(gap < 80);
    };

    /* ── Restore draft after a bounced turn ──────────────────────────── */
    const { draftRestore, consumeDraftRestore } = chat;
    useEffect(() => {
        if (draftRestore) {
            const text = consumeDraftRestore();
            if (text) composerRef.current?.setText(text);
        }
    }, [draftRestore, consumeDraftRestore, composerRef]);

    const applySuggestion = (s: MetSuggestion) => {
        if (s.id) void metApi.markSuggestionUsed(s.id);
        void chat.send({ text: s.prompt });
    };

    const retry = (m: MetMessage) => {
        if (m.role === 'user') return void chat.send({ text: m.content, attachments: [] });
        // Error block: resend the last user turn.
        const lastUser = [...chat.messages].reverse().find((x) => x.role === 'user');
        if (lastUser) void chat.send({ text: lastUser.content });
    };

    const groups = useMemo(() => {
        return chat.messages.map((m, i) => {
            const prev = chat.messages[i - 1];
            const next = chat.messages[i + 1];
            return { m, start: !prev || prev.role !== m.role, end: !next || next.role !== m.role };
        });
    }, [chat.messages]);

    const disabled = !features.available;
    const title = chat.conversation?.title && chat.conversation.title !== 'گفتگوی جدید' ? chat.conversation.title : null;

    /* ── Header ──────────────────────────────────────────────────────── */
    const header = (
        <header
            className={`shrink-0 flex items-center gap-2 px-3 sm:px-5 ${isMobile ? 'h-14 pt-[env(safe-area-inset-top)]' : 'h-14'} border-b border-[var(--border)]/40 bg-[color-mix(in_srgb,var(--bg-app)_82%,transparent)] backdrop-blur-lg z-20`}
            dir="rtl"
        >
            <button
                type="button"
                onClick={() => onOpenPanel('subjects')}
                className="flex items-center gap-2.5 min-w-0 rounded-[14px] py-1 pr-1 pl-2 hover:bg-[var(--hover-overlay)] transition-colors"
                aria-label="انتخاب درس"
            >
                <span className="w-9 h-9 shrink-0">
                    <Met size="100%" state={chatStatusToMetState(chat.status)} color={metColor} audioLevel={audioLevel} interactive={isMobile} />
                </span>
                <span className="min-w-0 text-right">
                    <span className="flex items-center gap-1 text-[13.5px] font-extrabold text-[var(--text-primary)] leading-tight">
                        <span className="truncate max-w-[40vw] sm:max-w-[28ch]">{title || 'مِت'}</span>
                        <ChevronDown size={13} className="text-[var(--text-muted)] shrink-0" />
                    </span>
                    <span className="flex items-center gap-1.5 text-[10.5px] leading-tight mt-0.5" style={{ color: subject.color }}>
                        <SlugIcon icon={subject.icon} size={10} />
                        <span className="font-bold">{subject.nameFa}</span>
                    </span>
                </span>
            </button>

            <div className="flex-1" />

            <CoinChip total={wallet.total} onClick={() => onOpenPanel('coins')} compact={isMobile} />
            {isMobile && (
                <>
                    <IconButton label="تاریخچه" size={36} onClick={() => onOpenPanel('history')}>
                        <History size={18} strokeWidth={1.9} />
                    </IconButton>
                    <IconButton label="تنظیمات" size={36} onClick={() => onOpenPanel('settings')}>
                        <Settings2 size={18} strokeWidth={1.9} />
                    </IconButton>
                </>
            )}
            <IconButton label="گفتگوی جدید" size={36} tone="primary" onClick={onNewChat} disabled={chat.busy}>
                <Plus size={19} strokeWidth={2.1} />
            </IconButton>
        </header>
    );

    /* ── Empty-state hero ────────────────────────────────────────────── */
    const hero = (
        <motion.div
            key={`hero-${subjectKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center"
            dir="rtl"
        >
            <div className="w-24 h-24 sm:w-28 sm:h-28 mb-4">
                <Met size="100%" state={chatStatusToMetState(chat.status) === 'idle' ? 'curious' : chatStatusToMetState(chat.status)} color={metColor} audioLevel={audioLevel} glow interactive />
            </div>
            <h1 className="text-[20px] sm:text-[22px] font-black text-[var(--text-primary)] m-0 leading-tight">{greeting(studentFirstName)}</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 mb-5 max-w-[34ch] leading-relaxed m-0">
                {subjectKey === 'general' ? 'هر سؤالی داری بپرس؛ یا یک درس انتخاب کن تا دقیق‌تر کمکت کنم.' : `امروز در ${subject.nameFa} چه چیزی را با هم حل کنیم؟`}
            </p>

            <SubjectPicker subjects={subjects} value={subjectKey} onChange={onSubjectChange} variant="chips" className="mb-6 max-w-[520px]" />

            <AnimatePresence mode="wait">
                {suggestions.length > 0 && (
                    <motion.div
                        key={subjectKey}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: easeOut }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[620px]"
                    >
                        {suggestions.slice(0, 4).map((s, i) => (
                            <motion.button
                                key={`${s.id ?? i}-${s.title}`}
                                type="button"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 * i, duration: 0.25, ease: easeOut }}
                                onClick={() => applySuggestion(s)}
                                disabled={disabled || chat.busy}
                                className="group flex items-start gap-3 p-3 rounded-[16px] border border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] hover:border-[var(--color-primary-500)]/40 hover:bg-[color-mix(in_srgb,var(--color-primary-500)_6%,var(--bg-card))] text-right transition-colors disabled:opacity-50"
                            >
                                <span className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${subject.color} 14%, transparent)`, color: subject.color }}>
                                    <SlugIcon icon={s.icon} size={15} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[12.5px] font-extrabold text-[var(--text-primary)]">{s.title}</span>
                                    <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">{s.hint || s.prompt}</span>
                                </span>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );

    return (
        <div className="relative flex-1 flex flex-col min-h-0 h-full" dir="rtl">
            {header}

            <AnimatePresence initial={false}>
                {working && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: easeOut }}
                        className="shrink-0 overflow-hidden"
                    >
                        <div className="flex justify-center py-1.5 border-b border-[var(--border)]/35 bg-[color-mix(in_srgb,var(--color-primary-500)_7%,transparent)]">
                            <WorkingText text={workingStatusText(chat.status, chat.toolLabel)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative flex-1 min-h-0">
                <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain chat-scrollbar">
                    <div className="mx-auto w-full max-w-[820px] px-3 sm:px-6 flex flex-col min-h-full">
                        {chat.loading ? (
                            <div className="flex-1 grid place-items-center py-20"><GraySpinner /></div>
                        ) : isEmpty ? (
                            hero
                        ) : (
                            <div className="pt-3 pb-4">
                                {chat.hasMore && (
                                    <div className="flex justify-center mb-2">
                                        <button type="button" onClick={() => void chat.loadOlder()} disabled={chat.loadingMore} className="h-8 px-3 rounded-full border border-[var(--border)]/70 text-[11.5px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 disabled:opacity-50">
                                            {chat.loadingMore ? <GraySpinner size={12} /> : <History size={12} />} پیام‌های قبلی
                                        </button>
                                    </div>
                                )}
                                {groups.map(({ m, start, end }) => (
                                    <Message
                                        key={m.id}
                                        message={m}
                                        metColor={metColor}
                                        isGroupStart={start}
                                        isGroupEnd={end}
                                        canSpeak={features.tts && settings.voiceReplies}
                                        canRegenerate={features.available && m.id === chat.lastAssistantId}
                                        busy={chat.busy}
                                        onSpeak={onSpeak}
                                        onRegenerate={(id) => void chat.regenerate(id)}
                                        onRetry={retry}
                                    />
                                ))}
                                {/* Typing dots until the first streamed token — never pair with an empty bubble. */}
                                <AnimatePresence>
                                    {chat.busy && !chat.messages.some((m) => m.streaming && !!m.content) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.2, ease: easeOut }}
                                            className="flex w-full justify-end gap-2.5 mt-5"
                                        >
                                            <div className="inline-flex items-center justify-center min-w-[2.75rem] h-9 px-3 rounded-[16px] rounded-tr-[6px] bg-[color-mix(in_srgb,var(--text-primary)_4.5%,var(--bg-card))] border border-[var(--border)]/50">
                                                <TypingDots />
                                            </div>
                                            <div className="w-7 shrink-0 mt-1">
                                                <div className="w-7 h-7"><Met size="100%" state="thinking" color={metColor} /></div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {!atBottom && !isEmpty && (
                        <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.8, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 6 }}
                            onClick={() => { setAtBottom(true); scrollToBottom(); }}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full grid place-items-center bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] shadow-lg"
                            aria-label="برو به آخر گفتگو"
                        >
                            <ArrowDown size={16} />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            <div className="shrink-0 px-3 sm:px-6 pt-1" style={{ paddingBottom: bottomInset || 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <div className="mx-auto w-full max-w-[820px]">
                    <Composer
                        ref={composerRef}
                        features={features}
                        subjectKey={subjectKey}
                        conversationId={chat.conversation?.id ?? null}
                        references={chat.references}
                        onReferencesChange={chat.setReferences}
                        ensureConversation={ensureConversation}
                        busy={chat.busy}
                        disabled={disabled}
                        disabledReason={features.unavailableReason || undefined}
                        onSend={(input) => void chat.send(input)}
                        onStop={chat.stop}
                        onListening={onListening}
                        onLowCoins={() => { onOpenPanel('coins'); toast.error('سکه‌ی کافی نداری'); }}
                    />
                </div>
            </div>
        </div>
    );
}

export default ChatScreen;
