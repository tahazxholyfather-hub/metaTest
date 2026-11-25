import axios from 'axios';

const API_URL = 'https://tam24.ir/quizFlow/flow';
// Legacy shared token. Do not hardcode it; set VITE_LEGACY_FLOW_TOKEN locally if this client is still used.
const APP_TOKEN = import.meta.env.VITE_LEGACY_FLOW_TOKEN || '';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-APP-TOKEN': APP_TOKEN
    }
});

export async function apiCall<T = any>(action: string, data: Record<string, any> = {}): Promise<T> {
    const res = await api.post('', { action, ...data });
    return res.data as T;
}
