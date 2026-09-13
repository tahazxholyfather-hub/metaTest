import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Met, subjectToMetColor } from '../../components/met';
import { errorCode, errorMessage, metApi } from './api';
import { Composer, type ComposerHandle } from './Composer';
import { Message } from './Message';
import type { MetFeatures, MetSettings, MetWallet, QuizIntent, QuizQuestionContext, SubjectKey } from './types';
import { CoinChip, EmptyHint, GraySpinner, TypingDots, springPanel, useIsMobile } from './ui';
import { useMetChat } from './useMetChat';

type Props = {
    open: boolean;
    onClose: () => void;
    questionId: number | null;
};

const FALLBACK_INTENTS: QuizIntent[] = [
    { key: 'didnt_understand_question', label: 'سوال رو متوجه نشدم' },
    { key: 'didnt_understand_answer', label: 'جواب رو متوجه نشدم' },
    { key: 'why_wrong', label: 'چرا جواب من غلطه؟' },
    { key: 'simpler', label: 'ساده‌تر توضیح بده' },
    { key: 'step_by_step', label: 'مرحله‌به‌مرحله توضیح بده' },
    { key: 'more_example', label: 'مثال بیشتر' },
    { key: 'similar_question', label: 'یک سوال مشابه بده' },
    { key: 'harder_question', label: 'یک سوال سخت‌تر بده' },
    { key: 'exam_tip', label: 'نکته کنکوری / امتحانی' },
];

export function QuizMetPanel({ open, onClose, questionId }: Props) {
    const isMobile = useIsMobile();
    const [features, setFeatures] = useState<MetFeatures | null>(null);
    const [settings, setSettings] = useState<MetSettings | null>(null);
    const [wallet, setWallet] = useState<MetWallet | null>(null);
    const [context, setContext] = useState<QuizQuestionContext | null>(null);
    const [intents, setIntents] = useState<QuizIntent[]>(FALLBACK_INTENTS);
    const [bootError, setBootError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showCoins, setShowCoins] = useState(false);
    const composerRef = useRef<ComposerHandle>(null);

    const subjectKey: SubjectKey = context?.subjectKey || 'general';
    const metColor = subjectToMetColor(subjectKey);

    const chat = useMetChat({
        subjectKey,
        questionId,
        onWallet: setWallet,
        onInsufficientCoins: () => {
            setShowCoins(true);
            toast.error('سکه‌ی کافی نداری');
        },
    });

    const load = useCallback(async (qid: number) => {
        setLoading(true);
        setBootError(null);
        try {
            const [boot, session] = await Promise.all([
                features && settings ? null : metApi.bootstrap(),
                metApi.questionConversation(qid),
            ]);
            if (boot) {
                setFeatures(boot.features);
                setSettings(boot.settings);
            }
            setWallet(session.wallet);
            setContext(session.context);
            if (session.intents?.length) setIntents(session.intents);
            chat.hydrate(session.conversation, session.messages, session.hasMore);
        } catch (err) {
            setBootError(errorMessage(err, 'گفتگوی این سوال باز نشد'));
            if (errorCode(err) === 'QUESTION_NOT_ANSWERED') {
                toast.error('اول پاسخ سوال را ثبت کن');
            }
        } finally {
            setLoading(false);
        }
        // chat.hydrate is stable enough for this load cycle
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [features, settings]);

    useEffect(() => {
        if (!open || !questionId) return;
        void load(questionId);
    }, [open, questionId, load]);

    useEffect(() => {
        if (!open) chat.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const quizFeatures = useMemo<MetFeatures | null>(() => {
        if (!features) return null;
        return { ...features, pdfReferences: false, suggestions: false };
    }, [features]);

    const applyIntent = (intent: QuizIntent) => {
        if (chat.busy || !features?.available) return;
        void chat.send({ text: intent.label, intent: intent.key });
    };

    const ensureConversation = async () => {
        if (chat.conversation?.id) return chat.conversation.id;
        if (!questionId) throw new Error('NO_QUESTION');
        const session = await metApi.questionConversation(questionId);
        chat.hydrate(session.conversation, session.messages, session.hasMore);
        return session.conversation.id;
    };

    const showTyping = chat.busy && !chat.messages.some((m) => m.streaming && !!m.content);
    const empty = !chat.messages.length && !loading && !bootError;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[80] flex"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    dir="rtl"
                >
                    <motion.button
                        type="button"
                        aria-label="بستن مِت"
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    <motion.aside
                        role="dialog"
                        aria-label="گفتگو با مِت درباره این سوال"
                        initial={isMobile ? { y: '100%' } : { x: '-100%' }}
                        animate={isMobile ? { y: 0 } : { x: 0 }}
                        exit={isMobile ? { y: '100%' } : { x: '-100%' }}
                        transition={springPanel}
                        className={
                            isMobile
                                ? 'absolute inset-x-0 bottom-0 h-[min(92dvh,760px)] rounded-t-[28px] bg-[var(--bg-app)] border-t border-[var(--border)]/60 shadow-[0_-18px_50px_-24px_rgba(15,23,42,0.45)] flex flex-col'
                                : 'absolute top-0 bottom-0 left-0 w-[min(440px,42vw)] bg-[var(--bg-app)] border-l border-[var(--border)]/60 shadow-[-18px_0_50px_-24px_rgba(15,23,42,0.35)] flex flex-col'
                        }
                    >
                        <div className="shrink-0 flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]/50">
                            {isMobile && <span className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--border)]" />}
                            <div className="w-10 h-10 shrink-0">
                                <Met size="100%" state={chat.busy ? 'thinking' : 'idle'} color={metColor} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[14px] font-extrabold text-[var(--text-primary)] leading-tight">از مِت بپرس</div>
                                <div className="text-[11px] text-[var(--text-muted)] truncate">
                                    {context?.topic || context?.lesson || context?.subject || 'همین سوال'}
                                </div>
                            </div>
                            {wallet && <CoinChip total={wallet.total} onClick={() => setShowCoins((v) => !v)} compact />}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-9 h-9 rounded-[12px] grid place-items-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
                                aria-label="بستن"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {showCoins && wallet && (
                            <div className="shrink-0 mx-4 mt-3 rounded-[14px] border border-[var(--border)]/60 px-3 py-2.5 bg-[color-mix(in_srgb,var(--color-primary-500)_8%,var(--bg-card))]">
                                <div className="text-[11px] font-bold text-[var(--text-secondary)]">موجودی سکه</div>
                                <div className="text-[20px] font-black tabular-nums text-[var(--text-primary)]">{wallet.total}</div>
                                <div className="text-[10px] text-[var(--text-muted)]">روزانه {wallet.daily} · خریداری‌شده {wallet.purchased}</div>
                            </div>
                        )}

                        <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar px-4 py-3">
                            {loading && (
                                <div className="grid place-items-center py-16"><GraySpinner /></div>
                            )}
                            {bootError && !loading && (
                                <EmptyHint title="گفتگو باز نشد" body={bootError} />
                            )}
                            {empty && !bootError && (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 mx-auto mb-3"><Met size="100%" state="happy" color={metColor} /></div>
                                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed m-0">
                                        هرچی از این سوال نفهمیدی بپرس؛ مِت صورت سوال، گزینه‌ها و جواب تو را می‌داند.
                                    </p>
                                </div>
                            )}
                            {chat.messages.map((m, i) => (
                                <Message
                                    key={m.id}
                                    message={m}
                                    metColor={metColor}
                                    isGroupStart={i === 0 || chat.messages[i - 1].role !== m.role}
                                    isGroupEnd={i === chat.messages.length - 1 || chat.messages[i + 1].role !== m.role}
                                    canSpeak={!!(features?.tts && settings?.voiceReplies)}
                                    canRegenerate={!!(features?.available && m.id === chat.lastAssistantId)}
                                    busy={chat.busy}
                                    onSpeak={async (id) => {
                                        const r = await metApi.speak(id);
                                        if (r.wallet) setWallet(r.wallet);
                                        return r.url;
                                    }}
                                    onRegenerate={(id) => void chat.regenerate(id)}
                                    onRetry={() => void chat.regenerate(chat.lastAssistantId || 0)}
                                />
                            ))}
                            {showTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex w-full justify-end gap-2.5 mt-5"
                                >
                                    <div className="inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-[16px] rounded-tr-[6px] bg-[color-mix(in_srgb,var(--text-primary)_4.5%,var(--bg-card))] border border-[var(--border)]/50">
                                        <TypingDots />
                                        <span className="text-[11px] text-[var(--text-muted)]">{chat.toolLabel || 'مِت می‌نویسد…'}</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border)]/40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                            <div className="flex gap-1.5 overflow-x-auto chat-scrollbar pb-2 -mx-0.5">
                                {intents.map((intent) => (
                                    <button
                                        key={intent.key}
                                        type="button"
                                        disabled={chat.busy || !features?.available}
                                        onClick={() => applyIntent(intent)}
                                        className="shrink-0 h-8 px-3 rounded-full border border-[var(--border)]/70 bg-[var(--bg-card)] text-[11.5px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--color-primary-500)]/40 disabled:opacity-40"
                                    >
                                        {intent.label}
                                    </button>
                                ))}
                            </div>
                            {quizFeatures && (
                                <Composer
                                    ref={composerRef}
                                    features={quizFeatures}
                                    subjectKey={subjectKey}
                                    conversationId={chat.conversation?.id ?? null}
                                    references={[]}
                                    onReferencesChange={() => {}}
                                    ensureConversation={ensureConversation}
                                    busy={chat.busy}
                                    disabled={!features?.available}
                                    disabledReason={features?.unavailableReason || undefined}
                                    onSend={(input) => void chat.send(input)}
                                    onStop={chat.stop}
                                    onListening={() => {}}
                                    onLowCoins={() => { setShowCoins(true); toast.error('سکه‌ی کافی نداری'); }}
                                />
                            )}
                        </div>
                    </motion.aside>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default QuizMetPanel;
