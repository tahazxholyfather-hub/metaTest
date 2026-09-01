import { env } from '../config/env';
import { logger } from '../config/logger';
import { CustomError } from '../core/exceptions/custom-error';


export interface MainBackendUserInfo {
    id: string | number;
    username?: string;
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    social_links?: Record<string, unknown> | null;
    xp_level?: number;
    xp_points?: number;
    trophies?: number;
    current_plan?: string | null;
    role?: string | null;
    status?: string | null;
    created_at?: string;
    last_login?: string | null;
    last_login_ip?: string | null;
    days_remaining?: number;
    password_set?: boolean;
}

export type QuizMemberRole = 'member' | 'creator';

export interface UpsertQuizMemberParams {
    quizId: string;
    userId: string | number;
    role: QuizMemberRole;
    accessToken?: string;
}


export interface QuizMetadata {
    id: string;
    quizId?: string;
    shareCode?: string;
    title?: string;
    questionCount: number;
    totalQuestions?: number | null;
    durationSeconds?: number | null;
    ownerId?: string;
    creatorId?: string;
    isPublished?: boolean;
    playable?: boolean;
}

// export interface QuizAnswerSubmission {
//     questionId: string;
//     answer: unknown;
// }

export interface QuizGradeResult {
    score: number;
    total: number;
    correctCount: number;
    wrongCount: number;
    resultId?: number;
    id?: number;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface MainBackendEnvelope<T> {
    success?: boolean;
    data?: T;
    error?: {
        code?: string;
        message?: string;
    };
    message?: string;
}

export class MainBackendService {
    private readonly baseUrl: string;

    /**
     * Internal service key used for service-to-service communication.
     *
     * Main backend should check this header:
     * x-internal-service-key
     */
    private readonly internalKey?: string;

    constructor() {
        this.baseUrl = env.MAIN_BACKEND_URL.replace(/\/$/, '');

        /**
         * Preferred env name:
         * MAIN_BACKEND_INTERNAL_KEY
         *
         * Backward-compatible fallback:
         * MAIN_BACKEND_API_KEY
         */
        this.internalKey =
            env.MAIN_BACKEND_INTERNAL_KEY ||
            env.MAIN_BACKEND_API_KEY ||
            undefined;
    }

    async getQuizMetadata(
        quizId: string,
        accessToken?: string,
    ): Promise<QuizMetadata> {
        /**
         * Main backend endpoint:
         *
         * GET /internal/quizzes/:quizId/metadata
         *
         * Expected response:
         *
         * {
         *   "success": true,
         *   "data": {
         *     "id": 81,
         *     "quizId": 81,
         *     "shareCode": "ABC123",
         *     "title": "Some Quiz",
         *     "questionCount": 10,
         *     "durationSeconds": 300,
         *     "ownerId": 1
         *   }
         * }
         */
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(
            quizId,
        )}/metadata`;

        const response = await this.request(url, {
            method: 'GET',
            accessToken,
        });

        const rawData = this.unwrapResponse<Record<string, unknown>>(response);

        const data = this.normalizeQuizMetadata(rawData);

        if (!data.id || !data.quizId || typeof data.questionCount !== 'number') {

            logger.warn(
                {
                    quizId,
                    data,
                    rawData,
                },
                'Invalid quiz metadata response from main backend',
            );

            throw new CustomError(
                'Invalid quiz metadata response',
                502,
                'INVALID_MAIN_BACKEND_RESPONSE',
            );
        }

        if (data.questionCount <= 0) {
            throw new CustomError(
                'Quiz has no questions',
                400,
                'QUIZ_HAS_NO_QUESTIONS',
            );
        }

        if (data.isPublished === false) {
            throw new CustomError(
                'Quiz is not available',
                403,
                'QUIZ_NOT_AVAILABLE',
            );
        }

        if (data.playable === false) {
            throw new CustomError(
                'Quiz is not playable',
                400,
                'QUIZ_NOT_PLAYABLE',
            );
        }

        return data;
    }

    async addQuizMember(params: UpsertQuizMemberParams): Promise<void> {
        /**
         * Suggested main backend endpoint:
         *
         * POST /internal/quizzes/:quizId/members
         *
         * Body:
         * {
         *   userId: 123,
         *   role: 'creator' | 'member'
         * }
         */
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(
            params.quizId,
        )}/members`;

        await this.request(url, {
            method: 'POST',
            accessToken: params.accessToken,
            body: {
                userId: params.userId,
                role: params.role,
            },
        });
    }


    async dispatchFlow<T>(
        action: string,
        payload: Record<string, unknown> = {},
        accessToken?: string,
    ): Promise<T> {
        /**
         * Main backend flow endpoint:
         *
         * POST /flow
         *
         * Body:
         * {
         *   action: "get_user_info",
         *   payload: {}
         * }
         */
        const url = `${this.baseUrl}/api/flow`;

        const response = await this.request(url, {
            method: 'POST',
            accessToken,
            body: {
                action,
                payload,
            },
        });

        return this.unwrapResponse<T>(response);
    }


    async getUserInfo(accessToken: string): Promise<MainBackendUserInfo> {
        const data = await this.dispatchFlow<MainBackendUserInfo>(
            'get_user_info',
            {},
            accessToken,
        );

        if (!data || typeof data !== 'object') {
            logger.warn(
                {
                    data,
                },
                'Invalid get_user_info response from main backend',
            );

            throw new CustomError(
                'Invalid user info response',
                502,
                'INVALID_MAIN_BACKEND_RESPONSE',
            );
        }

        if (
            data.id === undefined ||
            data.id === null ||
            data.id === ''
        ) {
            logger.warn(
                {
                    data,
                },
                'get_user_info response does not contain a valid user id',
            );

            throw new CustomError(
                'Invalid user info response',
                502,
                'INVALID_MAIN_BACKEND_RESPONSE',
            );
        }

        return data;
    }




    async gradeQuizSubmission(params: {
        quizId: string;
        userId: string;
        lobbyCode: string;
        answers: Record<string, number>;
        timeSpent?: number;
        questionTimes?: Record<string, number>;
        selectionLog?: {
            questionId: number;
            optionId: number;
            timeSpentMs: number;
            timestamp: number;
        }[];
        accessToken?: string;
    }): Promise<QuizGradeResult> {
        /**
         * Main backend endpoint:
         *
         * POST /internal/quizzes/:quizId/grade
         *
         * Body:
         * {
         *   userId,
         *   lobbyCode,
         *   answers,
         *   timeSpent,
         *   questionTimes,
         *   selectionLog
         * }
         */
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(
            params.quizId,
        )}/grade`;

        const response = await this.request(url, {
            method: 'POST',
            accessToken: params.accessToken,
            body: {
                userId: params.userId,
                lobbyCode: params.lobbyCode,
                answers: params.answers,
                timeSpent: params.timeSpent,
                questionTimes: params.questionTimes,
                selectionLog: params.selectionLog,
            },
        });

        const data = this.unwrapResponse<QuizGradeResult>(response);

        if (
            !data ||
            typeof data.score !== 'number' ||
            typeof data.total !== 'number' ||
            typeof data.correctCount !== 'number' ||
            typeof data.wrongCount !== 'number'
        ) {
            logger.warn(
                {
                    quizId: params.quizId,
                    userId: params.userId,
                    data,
                },
                'Invalid quiz grading response from main backend',
            );

            throw new CustomError(
                'Invalid quiz grading response',
                502,
                'INVALID_MAIN_BACKEND_RESPONSE',
            );
        }

        return data;
    }

    async saveQuizResult(params: {
        quizId: string;
        userId: string;
        lobbyCode: string;
        result: QuizGradeResult;
        accessToken?: string;
    }): Promise<{ success: boolean; resultId?: number | string, note?: string } | undefined> {
        /**
         * Optional main backend endpoint:
         *
         * POST /internal/results
         */
        const url = `${this.baseUrl}/internal/results`;

        try {
            const response = await this.request(url, {
                method: 'POST',
                accessToken: params.accessToken,
                body: {
                    quizId: params.quizId,
                    userId: params.userId,
                    lobbyCode: params.lobbyCode,
                    result: params.result,
                },
            });

            // Return the response data so LobbyService can extract the resultId
            return response as { success: boolean; resultId?: number | string; note?: string };

        } catch (err) {
            /**
             * Saving result may be optional depending on your main backend.
             *
             * If saving is mandatory, remove this catch and let the error bubble.
             */
            logger.warn(
                {
                    err,
                    quizId: params.quizId,
                    userId: params.userId,
                    lobbyCode: params.lobbyCode,
                },
                'Failed to save result to main backend',
            );
            return { success: false };
        }
    }



    async setQuizFinished(quizId: string, accessToken?: string): Promise<void> {
        /**
         * Main backend endpoint:
         *
         * POST /internal/quizzes/:quizId/finish
         *
         * Body: {} (empty — the action is implicit in the endpoint)
         */
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(quizId)}/finish`;

        try {
            await this.request(url, {
                method: 'POST',
                accessToken,
                body: {},
            });
        } catch (err) {
            logger.warn(
                {
                    err,
                    quizId,
                },
                'Failed to notify main backend of quiz finish',
            );
            // Do not re-throw — callers handle this gracefully
        }
    }




    private async request(
        url: string,
        options: {
            method: HttpMethod;
            accessToken?: string;
            body?: unknown;
        },
    ): Promise<unknown> {
        const headers: Record<string, string> = {
            Accept: 'application/json',
        };

        if (options.body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }

        /**
         * This is the important fix.
         *
         * Your main backend middleware should read:
         *
         * req.get('x-internal-service-key')
         */
        if (this.internalKey) {
            headers['x-internal-service-key'] = this.internalKey;
        }

        /**
         * Optional user auth forwarding.
         *
         * Useful if your main backend also wants to know the actual user.
         */
        if (options.accessToken) {
            headers.Authorization = `Bearer ${options.accessToken}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(url, {
                method: options.method,
                headers,
                body:
                    options.body === undefined
                        ? undefined
                        : JSON.stringify(options.body),
                signal: controller.signal,
            });

            const responseBody = await this.parseResponseBody(response);

            if (!response.ok) {
                const message = this.extractErrorMessage(
                    responseBody,
                    'Main backend request failed',
                );

                logger.warn(
                    {
                        url,
                        method: options.method,
                        status: response.status,
                        responseBody,
                    },
                    'Main backend request failed',
                );

                throw new CustomError(
                    message,
                    response.status >= 500 ? 502 : response.status,
                    'MAIN_BACKEND_REQUEST_FAILED',
                    responseBody,
                );
            }

            return responseBody;
        } catch (err) {
            if (err instanceof CustomError) {
                throw err;
            }

            const isAbortError =
                err instanceof Error && err.name === 'AbortError';

            logger.error(
                {
                    err,
                    url,
                    method: options.method,
                    timeout: isAbortError,
                },
                isAbortError
                    ? 'Main backend request timed out'
                    : 'Main backend request error',
            );

            throw new CustomError(
                isAbortError
                    ? 'Main backend request timed out'
                    : 'Main backend unavailable',
                502,
                isAbortError
                    ? 'MAIN_BACKEND_TIMEOUT'
                    : 'MAIN_BACKEND_UNAVAILABLE',
            );
        } finally {
            clearTimeout(timeout);
        }
    }








    private async parseResponseBody(response: Response): Promise<unknown> {
        const contentType = response.headers.get('content-type') ?? '';

        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch {
                return null;
            }
        }

        const text = await response.text();

        /**
         * Express 404 usually returns HTML.
         * We keep it as text so logs show the real problem.
         */
        return text;
    }

    private unwrapResponse<T>(response: unknown): T {
        if (
            response &&
            typeof response === 'object' &&
            'success' in response &&
            'data' in response
        ) {
            const envelope = response as MainBackendEnvelope<T>;

            if (envelope.success === false) {
                const message =
                    envelope.error?.message ||
                    envelope.message ||
                    'Main backend returned an error';

                throw new CustomError(
                    message,
                    502,
                    envelope.error?.code || 'MAIN_BACKEND_ERROR',
                    response,
                );
            }

            return envelope.data as T;
        }

        return response as T;
    }

    private normalizeQuizMetadata(
        rawData: Record<string, unknown> | null | undefined,
    ): QuizMetadata {
        if (!rawData || typeof rawData !== 'object') {
            return {
                id: '',
                questionCount: 0,
            };
        }

        const idValue = rawData.id ?? rawData.quizId;
        const quizIdValue = rawData.quizId ?? rawData.id;

        const questionCountValue =
            rawData.questionCount ??
            rawData.totalQuestions ??
            rawData.questionsCount ??
            rawData.question_count;

        const durationSecondsValue =
            rawData.durationSeconds ??
            rawData.duration_seconds ??
            rawData.timeLimit ??
            rawData.time_limit;

        const ownerIdValue =
            rawData.ownerId ??
            rawData.creatorId ??
            rawData.owner_id ??
            rawData.creator_id;

        return {
            id: String(idValue ?? ''),
            quizId: quizIdValue === undefined ? undefined : String(quizIdValue),
            shareCode:
                rawData.shareCode === undefined
                    ? rawData.share_code === undefined
                        ? undefined
                        : String(rawData.share_code)
                    : String(rawData.shareCode),
            title:
                rawData.title === undefined ? undefined : String(rawData.title),
            questionCount: this.toNumber(questionCountValue, 0),
            totalQuestions: this.toOptionalNumber(
                rawData.totalQuestions ?? rawData.questionCount,
            ),
            durationSeconds: this.toOptionalNumber(durationSecondsValue),
            ownerId:
                ownerIdValue === undefined ? undefined : String(ownerIdValue),
            creatorId:
                rawData.creatorId === undefined &&
                rawData.creator_id === undefined
                    ? undefined
                    : String(rawData.creatorId ?? rawData.creator_id),
            isPublished:
                typeof rawData.isPublished === 'boolean'
                    ? rawData.isPublished
                    : typeof rawData.is_published === 'boolean'
                        ? rawData.is_published
                        : undefined,
            playable:
                typeof rawData.playable === 'boolean'
                    ? rawData.playable
                    : undefined,
        };
    }

    private extractErrorMessage(responseBody: unknown, fallback: string): string {
        if (!responseBody) {
            return fallback;
        }

        if (typeof responseBody === 'string') {
            /**
             * Avoid sending huge HTML pages to the frontend.
             */
            if (responseBody.includes('<!DOCTYPE html>')) {
                return fallback;
            }

            return responseBody.slice(0, 300);
        }

        if (typeof responseBody === 'object') {
            const body = responseBody as {
                message?: unknown;
                error?: {
                    message?: unknown;
                };
            };

            if (typeof body.error?.message === 'string') {
                return body.error.message;
            }

            if (typeof body.message === 'string') {
                return body.message;
            }
        }

        return fallback;
    }

    private toNumber(value: unknown, fallback: number): number {
        const numberValue = Number(value);

        if (!Number.isFinite(numberValue)) {
            return fallback;
        }

        return numberValue;
    }

    private toOptionalNumber(value: unknown): number | null | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (value === null) {
            return null;
        }

        const numberValue = Number(value);

        if (!Number.isFinite(numberValue)) {
            return undefined;
        }

        return numberValue;
    }
}

export const mainBackendService = new MainBackendService();
