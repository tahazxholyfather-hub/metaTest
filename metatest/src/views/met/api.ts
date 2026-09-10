import {
    MetApiError,
    type ChatStreamEvent,
    type MetBootstrap,
    type MetConversation,
    type MetLedgerEntry,
    type MetMemory,
    type MetMessage,
    type MetReference,
    type MetSettings,
    type MetSubject,
    type MetSuggestion,
    type MetWallet,
    type SubjectKey,
    type TranscribeResult,
    type UploadedImage,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const PREFIX = `${API_BASE}/ai-teacher`;

/** Safe message extraction for `catch (err: unknown)`. */
export function errorMessage(err: unknown, fallback = 'خطایی رخ داد'): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string' && err) return err;
    return fallback;
}

export function errorCode(err: unknown): string | null {
    return err instanceof MetApiError ? err.code : null;
}

function getAuthToken(): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split('; auth_token=');
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const token = getAuthToken();
    return token ? { ...extra, 'x-app-token': token } : extra;
}

async function parseError(res: Response): Promise<MetApiError> {
    const data = await res.json().catch(() => ({}));
    return new MetApiError(
        data?.message || `خطای سرور (${res.status})`,
        data?.code || (res.status === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR'),
        res.status,
        data?.wallet
    );
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${PREFIX}${path}`, { ...options, headers: authHeaders(headers), credentials: 'include' });
    if (!res.ok) throw await parseError(res);
    const data = await res.json().catch(() => ({}));
    if (data && data.success === false) throw new MetApiError(data.message || 'خطا', data.code || 'ERROR', res.status, data.wallet);
    return data as T;
}

async function upload<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${PREFIX}${path}`, { method: 'POST', headers: authHeaders(), body: form, credentials: 'include' });
    if (!res.ok) throw await parseError(res);
    const data = await res.json().catch(() => ({}));
    if (!data?.success) throw new MetApiError(data?.message || 'آپلود ناموفق بود', data?.code || 'UPLOAD_FAILED', res.status);
    return data.data as T;
}

type Ok<T> = { success: true; data: T };
type Paged<T> = { success: true; data: T; hasMore: boolean };

export const metApi = {
    bootstrap: () => request<Ok<MetBootstrap>>('/bootstrap').then((r) => r.data),

    listSubjects: () => request<Ok<MetSubject[]>>('/subjects').then((r) => r.data),

    suggestions: (subject: SubjectKey) =>
        request<Ok<MetSuggestion[]>>(`/suggestions?subject=${encodeURIComponent(subject)}`).then((r) => r.data),

    markSuggestionUsed: (id: number) => request<{ success: true }>(`/suggestions/${id}/used`, { method: 'POST' }).catch(() => undefined),

    openSession: () =>
        request<Ok<{ conversation: MetConversation | null; messages: MetMessage[]; hasMore: boolean; wallet: MetWallet }>>('/session').then((r) => r.data),

    createConversation: (subjectKey: SubjectKey) =>
        request<Ok<{ conversation: MetConversation }>>('/conversations', {
            method: 'POST',
            body: JSON.stringify({ subjectKey }),
        }).then((r) => r.data.conversation),

    listConversations: (params: { limit?: number; offset?: number; subject?: SubjectKey | null; q?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.offset) qs.set('offset', String(params.offset));
        if (params.subject) qs.set('subject', params.subject);
        if (params.q) qs.set('q', params.q);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<Paged<MetConversation[]>>(`/conversations${suffix}`).then((r) => ({ items: r.data, hasMore: r.hasMore }));
    },

    getConversation: (id: number, params: { beforeId?: number; limit?: number } = {}) => {
        const qs = new URLSearchParams();
        if (params.beforeId) qs.set('beforeId', String(params.beforeId));
        if (params.limit) qs.set('limit', String(params.limit));
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<Ok<{ conversation: MetConversation; messages: MetMessage[]; hasMore: boolean; references: MetReference[] }>>(
            `/conversations/${id}${suffix}`
        ).then((r) => r.data);
    },

    renameConversation: (id: number, title: string) =>
        request<Ok<{ title: string }>>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }).then((r) => r.data.title),

    deleteConversation: (id: number) => request<{ success: true }>(`/conversations/${id}`, { method: 'DELETE' }),

    wallet: () => request<Ok<MetWallet>>('/wallet').then((r) => r.data),

    ledger: (params: { limit?: number; offset?: number } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.offset) qs.set('offset', String(params.offset));
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<Paged<MetLedgerEntry[]>>(`/wallet/ledger${suffix}`).then((r) => ({ items: r.data, hasMore: r.hasMore }));
    },

    settings: () => request<Ok<MetSettings>>('/settings').then((r) => r.data),

    updateSettings: (patch: Partial<MetSettings>) =>
        request<Ok<MetSettings>>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.data),

    listMemory: () => request<Ok<MetMemory[]>>('/memory').then((r) => r.data),
    forgetMemory: (id: number) => request<{ success: true }>(`/memory/${id}`, { method: 'DELETE' }),
    clearMemory: () => request<Ok<{ cleared: number }>>('/memory', { method: 'DELETE' }).then((r) => r.data.cleared),

    listReferences: (conversationId: number) =>
        request<Ok<MetReference[]>>(`/conversations/${conversationId}/references`).then((r) => r.data),

    addReference: (conversationId: number, file: File) => {
        const form = new FormData();
        form.append('pdf', file, file.name);
        return upload<MetReference>(`/conversations/${conversationId}/references`, form);
    },

    removeReference: (conversationId: number, referenceId: number) =>
        request<{ success: true }>(`/conversations/${conversationId}/references/${referenceId}`, { method: 'DELETE' }),

    uploadImage: (file: File, conversationId?: number | null) => {
        const form = new FormData();
        form.append('image', file, file.name);
        if (conversationId) form.append('conversationId', String(conversationId));
        return upload<UploadedImage>('/upload-image', form);
    },

    transcribe: (audio: Blob, opts: { durationSeconds?: number; conversationId?: number | null; mimeType?: string } = {}) => {
        const form = new FormData();
        const ext = (opts.mimeType || audio.type || 'audio/webm').includes('mp4') ? 'm4a' : (opts.mimeType || audio.type || '').includes('ogg') ? 'ogg' : 'webm';
        form.append('audio', audio, `voice.${ext}`);
        if (opts.durationSeconds) form.append('durationSeconds', String(Math.round(opts.durationSeconds)));
        if (opts.conversationId) form.append('conversationId', String(opts.conversationId));
        return upload<TranscribeResult>('/voice/transcribe', form);
    },

    speak: (messageId: number) =>
        request<Ok<{ url: string; fileId?: number; charged: number; cached: boolean; wallet?: MetWallet }>>('/voice/speak', {
            method: 'POST',
            body: JSON.stringify({ messageId }),
        }).then((r) => r.data),

    /**
     * Stream one chat turn. Resolves when the stream ends; every SSE frame is
     * passed to `onEvent`. Aborting `signal` stops generation server-side.
     */
    streamChat: async (
        payload: {
            conversationId?: number | null;
            subjectKey?: SubjectKey;
            message: string;
            attachments?: { fileId: number }[];
            regenerateMessageId?: number | null;
            inputMode?: 'text' | 'voice';
        },
        onEvent: (event: ChatStreamEvent) => void,
        signal?: AbortSignal
    ): Promise<void> => {
        const res = await fetch(`${PREFIX}/chat/stream`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
            body: JSON.stringify(payload),
            credentials: 'include',
            signal,
        });

        if (!res.ok || !res.body) throw await parseError(res);

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        const dispatch = (chunk: string) => {
            let event = 'message';
            let dataStr = '';
            for (const line of chunk.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
            }
            if (!dataStr) return;
            try {
                onEvent({ event, data: JSON.parse(dataStr) } as ChatStreamEvent);
            } catch {
                /* malformed frame — ignore */
            }
        };

        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split('\n\n');
            buffer = frames.pop() || '';
            frames.forEach(dispatch);
        }
        if (buffer.trim()) dispatch(buffer);
    },
};

export type MetApi = typeof metApi;
