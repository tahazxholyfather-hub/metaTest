import axios from 'axios';

const API_URL = 'https://tam24.ir/quizFlow/flow';
const APP_TOKEN = 'TAM24_TOKEN_20260223';

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
