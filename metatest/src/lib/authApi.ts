// src/lib/authApi.ts

type Json = Record<string, any>;
type SubscriptionPlan = {
    id: string;
    name: string;
    days: number;
    price: number;
    planDiscountPercent: number;
    iconColors?: { primary: string; secondary: string };
    shimmerClass?: string;
    activeShadow?: string;
    activeBorder?: string;
    popular?: boolean;
};

type SubscriptionPricing = {
    basePrice: number;
    planDiscountPercent: number;
    planDiscountAmount: number;
    priceAfterPlanDiscount: number;
    couponPercent: number;
    couponDiscountAmount: number;
    finalPrice: number;
};

type ValidateDiscountResponse = {
    coupon: {
        id: number;
        code: string;
        percent: number;
    };
    pricing: SubscriptionPricing;
};

type CreatePaymentResponse = {
    paymentId?: number;
    authority?: string;
    paymentUrl?: string;
    directActivated?: boolean;
};

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || "/api";

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
    }
    return null;
}

export function setAuthCookie(token: string) {
    document.cookie = `auth_token=${token}; path=/; max-age=86400; secure; samesite=strict`;
}

export function clearAuthCookie() {
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function request<T = any>(
    url: string,
    options: RequestInit & { params?: Record<string, any> } = {}
): Promise<T> {
    const token = getCookie("auth_token");

    const headers: Record<string, string> = {
        ...((options.headers as Record<string, string>) || {}),
    };

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["x-app-token"] = token;
    }

    let finalUrl = url;
    if (options.params) {
        const qs = new URLSearchParams(
            Object.entries(options.params)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, String(v)])
        ).toString();
        if (qs) finalUrl = `${url}?${qs}`;
    }

    const res = await fetch(finalUrl, {
        method: options.method || "POST",
        headers,
        body: options.body,
        credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

    if (!res.ok) {
        if (res.status === 401) clearAuthCookie();

        const message =
            (data && typeof data === "object" && (data.message || data.error)) ||
            `خطای سرور (${res.status})`;

        throw new Error(message);
    }

    if (
        data &&
        typeof data === "object" &&
        "token" in data &&
        typeof data.token === "string"
    ) {
        setAuthCookie(data.token);
    }

    return data as T;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const authApi = {
    loginPassword: (payload: { mobile: string; password: string }) =>
        request<{ success: boolean; token?: string; user?: Json }>(
            `${API_BASE}/flow`,
            {
                body: JSON.stringify({ action: "password_login", ...payload }),
            }
        ),

    sendOtp: (payload: { mobile: string }) =>
        request<{ success: boolean }>(
            `${API_BASE}/flow`,
            {
                body: JSON.stringify({ action: "send_otp", ...payload }),
            }
        ),

    verifyOtp: (payload: { mobile: string; code: string }) =>
        request<{ success: boolean; token?: string; user?: Json }>(
            `${API_BASE}/flow`,
            {
                body: JSON.stringify({ action: "verify_otp", ...payload }),
            }
        ),

    guestLogin: () =>
        request<{ success: boolean; token?: string }>(
            `${API_BASE}/flow`,
            {
                body: JSON.stringify({ action: "guest_login" }),
            }
        ),

    getUser: () =>
        request<{ success: boolean; data?: Json }>(
            `${API_BASE}/flow`,
            {
                body: JSON.stringify({ action: "get_user_info" }),
            }
        ),

    updateProfile: (updates: Json) =>
        request<{ success: boolean; data?: Json }>(
            `${API_BASE}/flow`,
            {
                body: JSON.stringify({ action: "update_profile", ...updates }),
            }
        ),
};

// ---------------------------------------------------------------------------
// Flow API
// ---------------------------------------------------------------------------

export const flowApi = {
    dispatch: (action: string, payload: any = {}) => {
        let body: any;
        const headers: Record<string, string> = {};

        const hasFile =
            payload instanceof FormData ||
            (payload &&
                typeof payload === "object" &&
                Object.values(payload).some(
                    (val) => val instanceof File || val instanceof Blob
                ));

        if (hasFile) {
            const formData =
                payload instanceof FormData ? payload : new FormData();

            if (!(payload instanceof FormData)) {
                Object.keys(payload).forEach((key) => {
                    if (
                        typeof payload[key] === "object" &&
                        !(payload[key] instanceof File) &&
                        !(payload[key] instanceof Blob)
                    ) {
                        formData.append(key, JSON.stringify(payload[key]));
                    } else {
                        formData.append(key, payload[key]);
                    }
                });
            }

            formData.append("action", action);
            body = formData;
        } else {
            body = JSON.stringify({ action, ...payload });
        }

        return request<{
            success: boolean;
            data?: any;
            message?: string;
            token?: string;
        }>(`${API_BASE}/flow`, { method: "POST", headers, body });
    },

    // ===================== Subscription / Payments =====================

    subscriptionPlans: () =>
        request<{ success: boolean; data?: SubscriptionPlan[]; message?: string }>(
            `${API_BASE}/payments/plans`,
            { method: "GET" }
        ),

    validateSubscriptionDiscount: (payload: { code: string; planId: string }) => // planId به string تغییر یافت
        request<{ success: boolean; data?: ValidateDiscountResponse; message?: string }>(
            `${API_BASE}/payments/discount/validate`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            }
        ),

    createSubscriptionPayment: (payload: {
        planId: string;
        discountCode?: string;
        metadata?: {
            userId?: string;
            mobile?: string;
            name?: string;
            email?: string;
            username?: string;
        }
    }) => // آپدیت تایپ‌ها برای تطابق با دیتای ارسالی
        request<{ success: boolean; data?: CreatePaymentResponse; message?: string }>(
            `${API_BASE}/payments/create`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            }
        ),

    getMySubscriptionStatus: () =>
        request<{ success: boolean; data?: any; message?: string }>(
            `${API_BASE}/payments/me`,
            { method: "GET" }
        ),



    // Dashboard (uses /api/dashboard routes, not /api/flow)
    getDashboardData: () =>
        request<Json>(`${API_BASE}/dashboard/data`, { method: "GET" }),

    claimTaskReward: (taskId: number) =>
        request<Json>(`${API_BASE}/dashboard/claim-reward`, {
            body: JSON.stringify({ taskId }),
        }),

    getTourStatus: (tourKey: string) =>
        request<{ success: boolean; completed: boolean }>(
            `${API_BASE}/dashboard/tour-status?tourKey=${encodeURIComponent(tourKey)}`,
            { method: "GET" }
        ),

    // ذخیره وضعیت بازدید تور (قبلاً با نام markTourAsViewed تعریف شده بود)
    completeTour: (tourKey: string) =>
        request<{ success: boolean }>(`${API_BASE}/dashboard/tour-viewed`, {
            method: "POST",
            body: JSON.stringify({ tourKey }),
        }),

    submitReferrerCode: (referrerCode: string) =>
        request<Json>(`${API_BASE}/dashboard/referrer-code`, {
            body: JSON.stringify({ referrerCode }),
        }),


    updateTaskProgress: (taskId: number, progressIncrement = 1) =>
        request<Json>(`${API_BASE}/dashboard/update-task-progress`, {
            body: JSON.stringify({ taskId, progressIncrement }),
        }),

    // User
    getUserInfo: () => flowApi.dispatch("get_user_info"),

    saveUserActivity: (data: {
        user_id: number;
        page_view: string;
        seconds: number;
    }) => flowApi.dispatch("save_user_activity", data),

    saveViewsCount: (data: { view: string }) =>
        flowApi.dispatch("views_count", data),

    // Quiz
    getSubjects: () => flowApi.dispatch("get_subjects"),

    getGradesBySubject: (subjectId: number) =>
        flowApi.dispatch("get_grades_by_subject", { subjectId }),

    getChaptersBySubject: (subjectId: number, gradeId?: number) =>
        flowApi.dispatch("get_chapters_by_subject", { subjectId, gradeId }),

    getMabahesByChapter: (chapterId: number) =>
        flowApi.dispatch("get_mabahes_by_chapter", { chapterId }),

    getQuizTypes: () => flowApi.dispatch("get_quiz_types"),

    startSession: (filters: Json) =>
        flowApi.dispatch("start_session", filters),

    getPracticeQuestion: (sessionId: string) =>
        flowApi.dispatch("get_practice_question", { sessionId }),

    getSpecificQuestion: (questionId: number) =>
        flowApi.dispatch("get_specific_question", { questionId }),

    checkAnswer: (payload: {
        sessionId: string;
        questionId: number;
        selectedOption: number;
    }) => flowApi.dispatch("checkAnswer", payload),

    finishQuiz: (sessionId: string) =>
        flowApi.dispatch("finish_quiz", { sessionId }),

    // Favorites
    getFavorites: () => flowApi.dispatch("get_favorites"),

    addFavorite: (questionId: number) =>
        flowApi.dispatch("add_favorite", { questionId }),

    removeFavorite: (questionId: number) =>
        flowApi.dispatch("remove_favorite", { questionId }),

    // Notes
    getNotes: () => flowApi.dispatch("get_notes"),

    addNote: (payload: { title: string; content: string; questionId?: number }) =>
        flowApi.dispatch("add_note", payload),

    deleteNote: (noteId: number) =>
        flowApi.dispatch("delete_note", { noteId }),

    // Review Box
    getReviewLaterQuestions: () =>
        flowApi.dispatch("get_review_later_questions"),

    addToReviewLater: (questionId: number) =>
        flowApi.dispatch("add_to_review_later", { questionId }),

    removeFromReviewLater: (questionId: number) =>
        flowApi.dispatch("remove_from_review_later", { questionId }),

    // Reports
    reportQuestion: (payload: {
        questionId: number;
        reportType: string;
        description?: string;
    }) => flowApi.dispatch("report_question", payload),

    getReports: () => flowApi.dispatch("get_reports"),

    // Quiz World
    getGradesBySubjectsMulti: (subjectIds: number[]) =>
        flowApi.dispatch("get_grades_by_subjects_multi", { subjectIds }),

    getChaptersBySubjectsMulti: (subjectIds: number[], gradeIds?: number[]) =>
        flowApi.dispatch("get_chapters_by_subjects_multi", {
            subjectIds,
            gradeIds,
        }),

    getMabahesByChaptersMulti: (chapterIds: number[]) =>
        flowApi.dispatch("get_mabahes_by_chapters_multi", { chapterIds }),

    generateCode: () => flowApi.dispatch("generate_code"),

    createQuiz: (payload: Json) => flowApi.dispatch("create_quiz", payload),

    getQuizByShareCode: (shareCode: string) =>
        flowApi.dispatch("get_quiz_by_share_code", { shareCode }),

    getQuizQuestions: (quizId: number) =>
        flowApi.dispatch("get_quiz_questions", { quizId }),

    checkUserMember: (quizId: number) =>
        flowApi.dispatch("check_user_member", { quizId }),

    getQuizInfo: (quizId: number) =>
        flowApi.dispatch("get_quiz_info", { quizId }),

    submitQuizAnswers: (payload: {
        quizId: number;
        answers: Record<number, number>;
    }) => flowApi.dispatch("submit_quiz_answers", payload),

    getQuizResultById: (resultId: number) =>
        flowApi.dispatch("get_quiz_result_by_id", { resultId }),

    getQuizMembers: (quizId: number) =>
        flowApi.dispatch("get_quiz_members", { quizId }),

    getQuizResultByUserAndQuiz: (quizId: number) =>
        flowApi.dispatch("get_quiz_result_by_user_and_quiz", { quizId }),

    finishingQuiz: (quizId: number) =>
        flowApi.dispatch("finishing_quiz", { quizId }),
};
