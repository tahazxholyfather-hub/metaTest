const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api';

type Json = Record<string, any>;

async function adminRequest<T = any>(path: string, options: RequestInit & { params?: Record<string, any> } = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const headers: Record<string, string> = {
        ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let url = `${API_BASE}/admin${path}`;
    if (params) {
        const qs = new URLSearchParams(
            Object.entries(params)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => [k, String(v)])
        ).toString();
        if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
        method: fetchOptions.method || 'GET',
        headers,
        body: fetchOptions.body,
        credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (
            res.status === 401 &&
            typeof window !== 'undefined' &&
            path !== '/auth/login' &&
            path !== '/auth/me' &&
            path !== '/auth/logout'
        ) {
            window.dispatchEvent(new Event('admin-session-expired'));
        }
        const err: any = new Error(data?.message || `Server error (${res.status})`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data as T;
}

export const adminApi = {
    login: (username: string, password: string) =>
        adminRequest<{ success: boolean; user?: Json; message?: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    me: () => adminRequest<{ success: boolean; user?: Json; message?: string }>('/auth/me'),

    logout: () => adminRequest<{ success: boolean }>('/auth/logout', { method: 'POST' }),

    dashboard: () => adminRequest<Json>('/dashboard'),

    listAdmins: () => adminRequest<{ success: boolean; admins: Json[] }>('/admins'),
    createAdmin: (payload: Json) =>
        adminRequest<{ success: boolean; admin?: Json; message?: string }>('/admins', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateAdmin: (id: number, payload: Json) =>
        adminRequest<{ success: boolean; admin?: Json; message?: string }>(`/admins/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    deleteAdmin: (id: number) =>
        adminRequest<{ success: boolean; message?: string }>(`/admins/${id}`, { method: 'DELETE' }),

    aiSettings: () => adminRequest<Json>('/ai/settings'),
    saveAiSettings: (settings: Json) =>
        adminRequest<Json>('/ai/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
    aiStats: () => adminRequest<Json>('/ai/stats'),
    aiUsage: () => adminRequest<Json>('/ai/usage'),

    aiSubjects: () => adminRequest<Json>('/ai/subjects'),
    saveAiSubject: (key: string, payload: Json) =>
        adminRequest<Json>(`/ai/subjects/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
    resetAiSubjectPrompts: (key: string) =>
        adminRequest<Json>(`/ai/subjects/${encodeURIComponent(key)}/reset-prompts`, { method: 'POST' }),

    aiKnowledge: (params?: Json) => adminRequest<Json>('/ai/knowledge', { params }),
    aiKnowledgeItem: (id: number) => adminRequest<Json>(`/ai/knowledge/${id}`),
    saveAiKnowledge: (payload: Json, id?: number) =>
        id
            ? adminRequest<Json>(`/ai/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
            : adminRequest<Json>('/ai/knowledge', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAiKnowledge: (id: number) =>
        adminRequest<Json>(`/ai/knowledge/${id}`, { method: 'DELETE' }),

    aiSuggestions: (params?: Json) => adminRequest<Json>('/ai/suggestions', { params }),
    saveAiSuggestion: (payload: Json, id?: number) =>
        id
            ? adminRequest<Json>(`/ai/suggestions/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
            : adminRequest<Json>('/ai/suggestions', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAiSuggestion: (id: number) =>
        adminRequest<Json>(`/ai/suggestions/${id}`, { method: 'DELETE' }),

    aiBooks: () => adminRequest<Json>('/ai/books'),
    saveAiBook: (payload: Json, id?: number) =>
        id
            ? adminRequest<Json>(`/ai/books/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
            : adminRequest<Json>('/ai/books', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAiBook: (id: number) =>
        adminRequest<Json>(`/ai/books/${id}`, { method: 'DELETE' }),
    ingestAiBook: (id: number, payload: Json) =>
        adminRequest<Json>(`/ai/books/${id}/ingest`, { method: 'POST', body: JSON.stringify(payload) }),

    aiPricing: () => adminRequest<Json>('/ai/pricing'),
    saveAiPricing: (payload: Json, id?: number) =>
        id
            ? adminRequest<Json>(`/ai/pricing/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
            : adminRequest<Json>('/ai/pricing', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAiPricing: (id: number) =>
        adminRequest<Json>(`/ai/pricing/${id}`, { method: 'DELETE' }),

    aiWallets: (q: string) => adminRequest<Json>('/ai/wallets', { params: { q } }),
    adjustAiWallet: (userId: number, payload: Json) =>
        adminRequest<Json>(`/ai/wallets/${userId}/adjust`, { method: 'POST', body: JSON.stringify(payload) }),

    aiMemory: (params?: Json) => adminRequest<Json>('/ai/memory', { params }),
    saveAiMemory: (payload: Json, id?: number) =>
        id
            ? adminRequest<Json>(`/ai/memory/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
            : adminRequest<Json>('/ai/memory', { method: 'POST', body: JSON.stringify(payload) }),
    deleteAiMemory: (id: number) => adminRequest<Json>(`/ai/memory/${id}`, { method: 'DELETE' }),

    aiConversations: (params?: Json) => adminRequest<Json>('/ai/conversations', { params }),
    aiConversation: (id: number) => adminRequest<Json>(`/ai/conversations/${id}`),
    deleteAiConversation: (id: number) => adminRequest<Json>(`/ai/conversations/${id}`, { method: 'DELETE' }),

    aiUserSettings: (userId: number) => adminRequest<Json>(`/ai/user-settings/${userId}`),
    saveAiUserSettings: (userId: number, payload: Json) =>
        adminRequest<Json>(`/ai/user-settings/${userId}`, { method: 'PUT', body: JSON.stringify(payload) }),
};
