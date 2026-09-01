import type {
    AiBootstrap,
    AiConversationSummary,
    AiMessage,
    AiSettings,
    AiStudentProfile,
    AiTeacherPublic,
    AiWallet,
} from './types';

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api';

function getAuthToken(): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; auth_token=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) headers['x-app-token'] = token;

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `خطای سرور (${res.status})`);
    }
    return data as T;
}

export const aiTeacherApi = {
    bootstrap: () =>
        request<{ success: boolean; data: AiBootstrap }>('/ai-teacher/bootstrap', { method: 'GET' }),

    listTeachers: () =>
        request<{ success: boolean; data: AiTeacherPublic[] }>('/ai-teacher/teachers', { method: 'GET' }),

    saveProfile: (profile: AiStudentProfile) =>
        request('/ai-teacher/profile', {
            method: 'POST',
            body: JSON.stringify(profile),
        }),

    selectTeacher: (teacherId: number) =>
        request<{
            success: boolean;
            data: {
                teacher: AiTeacherPublic;
                conversation: { id: number; title: string; teacherId: number };
                starterMessage?: AiMessage;
                wallet: AiWallet;
            };
        }>('/ai-teacher/select-teacher', {
            method: 'POST',
            body: JSON.stringify({ teacherId }),
        }),

    openSession: () =>
        request<{
            success: boolean;
            data: {
                teacher: AiTeacherPublic;
                conversation: { id: number; title: string; teacherId: number };
                messages: AiMessage[];
                wallet: AiWallet;
            };
        }>('/ai-teacher/session', { method: 'GET' }),

    listConversations: (params?: { limit?: number; offset?: number }) => {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.offset) qs.set('offset', String(params.offset));
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<{ success: boolean; data: AiConversationSummary[] }>(
            `/ai-teacher/conversations${suffix}`,
            { method: 'GET' }
        );
    },

    getConversation: (id: number) =>
        request<{
            success: boolean;
            data: {
                conversation: { id: number; title: string; teacherId: number };
                teacher: AiTeacherPublic;
                messages: AiMessage[];
            };
        }>(`/ai-teacher/conversations/${id}`, { method: 'GET' }),

    createConversation: () =>
        request<{
            success: boolean;
            data: {
                conversation: { id: number };
                starterMessage: AiMessage;
                teacher: AiTeacherPublic;
            };
        }>('/ai-teacher/conversations', { method: 'POST', body: '{}' }),

    updateSettings: (settings: Partial<AiSettings>) =>
        request<{ success: boolean; data: AiSettings }>('/ai-teacher/settings', {
            method: 'POST',
            body: JSON.stringify(settings),
        }),

    getWallet: () =>
        request<{ success: boolean; data: AiWallet }>('/ai-teacher/wallet', { method: 'GET' }),

    listBooks: () =>
        request<{ success: boolean; data: import('./types').AiBook[] }>('/ai-teacher/books', { method: 'GET' }),

    /**
     * Stream a chat message via SSE over fetch ReadableStream.
     */
    streamChat: async (
        payload: { conversationId?: number | null; message: string },
        handlers: {
            onEvent: (event: string, data: any) => void;
            onError?: (err: Error) => void;
            signal?: AbortSignal;
        }
    ) => {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/ai-teacher/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'x-app-token': token } : {}),
            },
            body: JSON.stringify(payload),
            credentials: 'include',
            signal: handlers.signal,
        });

        if (!res.ok || !res.body) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.message || `خطای سرور (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const chunks = buffer.split('\n\n');
            buffer = chunks.pop() || '';

            for (const chunk of chunks) {
                const lines = chunk.split('\n');
                let event = 'message';
                let dataStr = '';
                for (const line of lines) {
                    if (line.startsWith('event:')) event = line.slice(6).trim();
                    if (line.startsWith('data:')) dataStr += line.slice(5).trim();
                }
                if (!dataStr) continue;
                try {
                    handlers.onEvent(event, JSON.parse(dataStr));
                } catch (err) {
                    handlers.onError?.(err as Error);
                }
            }
        }
    },
};
