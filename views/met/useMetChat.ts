import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, metApi } from './api';
import {
    MetApiError,
    type ChatStatus,
    type ChatStreamEvent,
    type MetAttachment,
    type MetConversation,
    type MetMessage,
    type MetReference,
    type MetWallet,
    type SubjectKey,
} from './types';

export interface PendingAttachment {
    fileId: number;
    type: 'image' | 'audio';
    url: string;
    mimeType?: string;
    durationSeconds?: number | null;
}

export interface SendInput {
    text: string;
    attachments?: PendingAttachment[];
    inputMode?: 'text' | 'voice';
    intent?: string | null;
}

type Options = {
    subjectKey: SubjectKey;
    onWallet: (w: MetWallet) => void;
    onConversationChange?: (c: MetConversation | null) => void;
    onStatus?: (s: ChatStatus) => void;
    /** Called when the server bounces a turn for lack of coins. */
    onInsufficientCoins?: (info: { needed?: number; balance?: number }) => void;
    /** When set, every turn is bound to this practice question. */
    questionId?: number | null;
};

const TOOL_LABELS: Record<string, string> = {
    search_questions: 'در حال جستجو در بانک سؤال',
    get_user_learning_profile: 'در حال بررسی پروفایل یادگیری',
    get_recent_quiz_activity: 'در حال مرور آزمون‌های اخیر',
    generate_image: 'در حال ساخت تصویر',
};

let tempSeq = 0;
const tempId = (prefix: string) => `${prefix}-${Date.now()}-${++tempSeq}`;

export function useMetChat({ subjectKey, onWallet, onConversationChange, onStatus, onInsufficientCoins, questionId = null }: Options) {
    const [conversation, setConversation] = useState<MetConversation | null>(null);
    const [messages, setMessages] = useState<MetMessage[]>([]);
    const [references, setReferences] = useState<MetReference[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [status, setStatus] = useState<ChatStatus>('ready');
    const [toolLabel, setToolLabel] = useState<string | null>(null);
    const [draftRestore, setDraftRestore] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const streamingIdRef = useRef<string | null>(null);
    const successTimer = useRef<number | null>(null);
    const conversationRef = useRef<MetConversation | null>(null);
    conversationRef.current = conversation;

    const setStatusSafe = useCallback(
        (s: ChatStatus) => {
            setStatus(s);
            onStatus?.(s);
        },
        [onStatus]
    );

    const setConversationBoth = useCallback(
        (c: MetConversation | null) => {
            setConversation(c);
            onConversationChange?.(c);
        },
        [onConversationChange]
    );

    const busy = status === 'sending' || status === 'thinking' || status === 'processing' || status === 'generating';

    useEffect(() => () => { abortRef.current?.abort(); if (successTimer.current) window.clearTimeout(successTimer.current); }, []);

    /* ── Loading ────────────────────────────────────────────────────────── */

    const openConversation = useCallback(
        async (id: number) => {
            setLoading(true);
            try {
                const data = await metApi.getConversation(id);
                setConversationBoth(data.conversation);
                setMessages(data.messages);
                setHasMore(data.hasMore);
                setReferences(data.references || []);
            } catch (err) {
                toast.error(errorMessage(err, 'گفتگو بارگذاری نشد'));
            } finally {
                setLoading(false);
            }
        },
        [setConversationBoth]
    );

    /** Show a conversation whose messages are already known (session bootstrap). */
    const hydrate = useCallback(
        (c: MetConversation | null, msgs: MetMessage[], more = false) => {
            setConversationBoth(c);
            setMessages(msgs);
            setHasMore(more);
            setReferences([]);
        },
        [setConversationBoth]
    );

    /** Blank slate. The conversation row is created lazily by the first turn. */
    const startNew = useCallback(() => {
        abortRef.current?.abort();
        setConversationBoth(null);
        setMessages([]);
        setHasMore(false);
        setReferences([]);
        setStatusSafe('ready');
    }, [setConversationBoth, setStatusSafe]);

    const loadOlder = useCallback(async () => {
        const c = conversationRef.current;
        const first = messages.find((m) => typeof m.id === 'number');
        if (!c || !first || loadingMore) return;
        setLoadingMore(true);
        try {
            const data = await metApi.getConversation(c.id, { beforeId: Number(first.id) });
            setMessages((prev) => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
        } catch {
            /* silent — user can retry by scrolling again */
        } finally {
            setLoadingMore(false);
        }
    }, [messages, loadingMore]);

    /* ── Streaming ──────────────────────────────────────────────────────── */

    const patchStreaming = useCallback((fn: (m: MetMessage) => MetMessage) => {
        const id = streamingIdRef.current;
        if (!id) return;
        setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    }, []);

    const flashSuccess = useCallback(() => {
        setStatusSafe('success');
        if (successTimer.current) window.clearTimeout(successTimer.current);
        successTimer.current = window.setTimeout(() => setStatusSafe('ready'), 1400);
    }, [setStatusSafe]);

    const runTurn = useCallback(
        async (payload: Parameters<typeof metApi.streamChat>[0], optimisticUserId: string | null) => {
            const controller = new AbortController();
            abortRef.current = controller;
            setToolLabel(null);
            setStatusSafe('sending');

            let gotDone = false;
            let userPersistedId: number | null = null;

            const handle = (ev: ChatStreamEvent) => {
                switch (ev.event) {
                    case 'status':
                        if (ev.data.status !== 'ready') setStatusSafe(ev.data.status);
                        break;
                    case 'meta': {
                        onWallet(ev.data.wallet);
                        const current = conversationRef.current;
                        if (!current || current.id !== ev.data.conversationId) {
                            setConversationBoth({
                                id: ev.data.conversationId,
                                title: 'گفتگوی جدید',
                                subjectKey: ev.data.subjectKey,
                                messageCount: 0,
                                lastMessageAt: new Date().toISOString(),
                                createdAt: new Date().toISOString(),
                                titleGenerated: false,
                            });
                        } else if (current.subjectKey !== ev.data.subjectKey) {
                            setConversationBoth({ ...current, subjectKey: ev.data.subjectKey });
                        }
                        break;
                    }
                    case 'user_message':
                        userPersistedId = Number(ev.data.id);
                        if (optimisticUserId) {
                            setMessages((prev) => prev.map((m) => (m.id === optimisticUserId ? { ...m, ...ev.data, attachments: m.attachments } : m)));
                        }
                        break;
                    case 'assistant_start': {
                        // Wait for the first delta so we never flash an empty bubble
                        // next to the typing indicator.
                        streamingIdRef.current = null;
                        setStatusSafe('generating');
                        break;
                    }
                    case 'delta': {
                        if (!streamingIdRef.current) {
                            const id = tempId('a');
                            streamingIdRef.current = id;
                            setMessages((prev) => [
                                ...prev,
                                { id, role: 'assistant', content: ev.data.text, attachments: [], status: 'streaming', streaming: true, createdAt: new Date().toISOString() },
                            ]);
                        } else {
                            patchStreaming((m) => ({ ...m, content: m.content + ev.data.text }));
                        }
                        break;
                    }
                    case 'tool':
                        setToolLabel(ev.data.status === 'running' ? TOOL_LABELS[ev.data.name] || 'در حال بررسی' : null);
                        break;
                    case 'attachment':
                        patchStreaming((m) => ({ ...m, attachments: [...m.attachments, ev.data as MetAttachment] }));
                        break;
                    case 'done': {
                        gotDone = true;
                        const final = ev.data.message;
                        const sid = streamingIdRef.current;
                        streamingIdRef.current = null;
                        setMessages((prev) => {
                            const withoutStreaming = prev.filter((m) => m.id !== sid);
                            return [...withoutStreaming, { ...final, streaming: false, truncated: !!ev.data.truncated }];
                        });
                        onWallet(ev.data.wallet);
                        const c = conversationRef.current;
                        if (c) setConversationBoth({ ...c, messageCount: (c.messageCount || 0) + (payload.regenerateMessageId ? 1 : 2), lastMessageAt: new Date().toISOString() });
                        setToolLabel(null);
                        flashSuccess();
                        break;
                    }
                    case 'title': {
                        const c = conversationRef.current;
                        if (c && c.id === ev.data.conversationId) setConversationBoth({ ...c, title: ev.data.title, titleGenerated: true });
                        break;
                    }
                    case 'error': {
                        const sid = streamingIdRef.current;
                        streamingIdRef.current = null;
                        setToolLabel(null);
                        if (ev.data.wallet) onWallet(ev.data.wallet);

                        const persisted = ev.data.userMessageId || userPersistedId;
                        if (ev.data.code === 'AI_STOPPED') {
                            // Partial reply (if any) arrives via `done`; here nothing was generated.
                            setMessages((prev) => prev.filter((m) => m.id !== sid));
                            setStatusSafe('ready');
                            break;
                        }

                        setMessages((prev) => {
                            let next = prev.filter((m) => m.id !== sid);
                            if (!persisted && optimisticUserId) {
                                // Server never stored the turn — give the text back to the composer.
                                const opt = next.find((m) => m.id === optimisticUserId);
                                if (opt?.content) setDraftRestore(opt.content);
                                next = next.filter((m) => m.id !== optimisticUserId);
                            }
                            return [
                                ...next,
                                { id: tempId('err'), role: 'assistant', content: '', attachments: [], status: 'error', error: ev.data.message, createdAt: new Date().toISOString() },
                            ];
                        });
                        if (ev.data.code === 'INSUFFICIENT_COINS') onInsufficientCoins?.({ needed: ev.data.needed, balance: ev.data.balance });
                        setStatusSafe('error');
                        window.setTimeout(() => setStatusSafe('ready'), 1600);
                        break;
                    }
                }
            };

            try {
                await metApi.streamChat(payload, handle, controller.signal);
                if (!gotDone && streamingIdRef.current) {
                    // Connection ended mid-stream without a `done` frame.
                    patchStreaming((m) => ({ ...m, streaming: false, status: 'stopped' }));
                    streamingIdRef.current = null;
                }
                if (!gotDone) setStatusSafe('ready');
            } catch (err) {
                if (controller.signal.aborted) {
                    // User stopped locally; keep whatever streamed so far.
                    patchStreaming((m) => ({ ...m, streaming: false, status: 'stopped' }));
                    streamingIdRef.current = null;
                    setStatusSafe('ready');
                    // The server settles the partial reply after our socket closes; pick up the real balance.
                    window.setTimeout(() => metApi.wallet().then(onWallet).catch(() => {}), 1500);
                    return;
                }
                const apiErr = err instanceof MetApiError ? err : null;
                if (apiErr?.wallet) onWallet(apiErr.wallet);
                const message = apiErr?.message || errorMessage(err, 'ارتباط با مِت برقرار نشد.');
                setMessages((prev) => {
                    let next = prev.filter((m) => m.id !== streamingIdRef.current);
                    if (optimisticUserId && !userPersistedId) {
                        const opt = next.find((m) => m.id === optimisticUserId);
                        if (opt?.content) setDraftRestore(opt.content);
                        next = next.filter((m) => m.id !== optimisticUserId);
                    }
                    return [...next, { id: tempId('err'), role: 'assistant', content: '', attachments: [], status: 'error', error: message, createdAt: new Date().toISOString() }];
                });
                streamingIdRef.current = null;
                if (apiErr?.code === 'INSUFFICIENT_COINS') onInsufficientCoins?.({});
                setStatusSafe('error');
                window.setTimeout(() => setStatusSafe('ready'), 1600);
            } finally {
                if (abortRef.current === controller) abortRef.current = null;
                setToolLabel(null);
            }
        },
        [flashSuccess, onInsufficientCoins, onWallet, patchStreaming, setConversationBoth, setStatusSafe]
    );

    const send = useCallback(
        async ({ text, attachments = [], inputMode = 'text', intent = null }: SendInput) => {
            const content = text.trim();
            if ((!content && !attachments.length) || busy) return;

            // Drop stale error blocks so the transcript stays clean.
            const optimisticId = tempId('u');
            setMessages((prev) => [
                ...prev.filter((m) => m.status !== 'error'),
                {
                    id: optimisticId,
                    role: 'user',
                    content,
                    attachments: attachments.map((a) => ({ type: a.type, url: a.url, fileId: a.fileId, mimeType: a.mimeType, durationSeconds: a.durationSeconds })),
                    status: 'complete',
                    createdAt: new Date().toISOString(),
                },
            ]);

            await runTurn(
                {
                    conversationId: conversationRef.current?.id ?? null,
                    subjectKey,
                    message: content,
                    attachments: attachments.filter((a) => a.type === 'image').map((a) => ({ fileId: a.fileId })),
                    inputMode,
                    questionId: questionId || null,
                    intent: intent || null,
                },
                optimisticId
            );
        },
        [busy, questionId, runTurn, subjectKey]
    );

    const regenerate = useCallback(
        async (assistantMessageId: number) => {
            const c = conversationRef.current;
            if (!c || busy) return;
            setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId && m.status !== 'error'));
            await runTurn({ conversationId: c.id, message: '', regenerateMessageId: assistantMessageId, questionId: questionId || null }, null);
        },
        [busy, questionId, runTurn]
    );

    const stop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const consumeDraftRestore = useCallback(() => {
        const d = draftRestore;
        setDraftRestore(null);
        return d;
    }, [draftRestore]);

    const lastAssistantId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.role === 'assistant' && typeof m.id === 'number' && !m.error) return m.id;
        }
        return null;
    }, [messages]);

    return {
        conversation,
        messages,
        references,
        setReferences,
        hasMore,
        loading,
        loadingMore,
        status,
        busy,
        toolLabel,
        lastAssistantId,
        draftRestore,
        consumeDraftRestore,
        openConversation,
        hydrate,
        startNew,
        loadOlder,
        send,
        regenerate,
        stop,
        setConversation: setConversationBoth,
    };
}
