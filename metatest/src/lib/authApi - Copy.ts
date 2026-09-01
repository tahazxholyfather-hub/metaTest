// src/lib/authApi.ts
type Json = Record<string, any>;

const API_BASE =
    (import.meta as any)?.env?.VITE_API_BASE_URL ||
    "/api"; // این مقدار را بر اساس Backend خود تنظیم کنید

// این مسیرها را با API واقعی جایگزین کنید
const endpoints = {
    login: `${API_BASE}/auth/login`,
    signupSendOtp: `${API_BASE}/auth/signup/send-otp`,
    signupVerifyOtp: `${API_BASE}/auth/signup/verify-otp`,
    signupComplete: `${API_BASE}/auth/signup/complete`,
    otpSend: `${API_BASE}/auth/otp/send`,
    otpVerify: `${API_BASE}/auth/otp/verify`,
    forgotSend: `${API_BASE}/auth/forgot/send`,
    forgotVerify: `${API_BASE}/auth/forgot/verify`,
    resetPassword: `${API_BASE}/auth/forgot/reset`,
};

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        method: options.method || "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        body: options.body,
        credentials: "include", // اگر نیاز به ارسال کوکی‌های سشن به سرور دارید
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
        const message = (data && (data.message || data.error)) || `خطای سرور (${res.status})`;
        throw new Error(message);
    }
    return data as T;
}

export const authApi = {
    loginPassword: (payload: { mobile: string; password: string }) =>
        request<{ token: string; user?: Json }>(endpoints.login, { body: JSON.stringify(payload) }),

    signupSendOtp: (payload: { mobile: string }) =>
        request<{ ok: boolean }>(endpoints.signupSendOtp, { body: JSON.stringify(payload) }),

    signupVerifyOtp: (payload: { mobile: string; code: string }) =>
        request<{ tempToken: string }>(endpoints.signupVerifyOtp, { body: JSON.stringify(payload) }),

    signupComplete: (payload: { tempToken: string; firstName: string; lastName: string; password: string }) =>
        request<{ token: string; user?: Json }>(endpoints.signupComplete, { body: JSON.stringify(payload) }),

    otpSend: (payload: { mobile: string }) =>
        request<{ ok: boolean }>(endpoints.otpSend, { body: JSON.stringify(payload) }),

    otpVerify: (payload: { mobile: string; code: string }) =>
        request<{ token: string; user?: Json }>(endpoints.otpVerify, { body: JSON.stringify(payload) }),

    forgotSend: (payload: { mobile: string }) =>
        request<{ ok: boolean }>(endpoints.forgotSend, { body: JSON.stringify(payload) }),

    forgotVerify: (payload: { mobile: string; code: string }) =>
        request<{ resetToken: string }>(endpoints.forgotVerify, { body: JSON.stringify(payload) }),

    resetPassword: (payload: { resetToken: string; password: string }) =>
        request<{ ok: boolean }>(endpoints.resetPassword, { body: JSON.stringify(payload) }),
};
