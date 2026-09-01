"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainBackendService = exports.MainBackendService = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const custom_error_1 = require("../core/exceptions/custom-error");
class MainBackendService {
    baseUrl;
    /**
     * Internal service key used for service-to-service communication.
     *
     * Main backend should check this header:
     * x-internal-service-key
     */
    internalKey;
    constructor() {
        this.baseUrl = env_1.env.MAIN_BACKEND_URL.replace(/\/$/, '');
        /**
         * Preferred env name:
         * MAIN_BACKEND_INTERNAL_KEY
         *
         * Backward-compatible fallback:
         * MAIN_BACKEND_API_KEY
         */
        this.internalKey =
            env_1.env.MAIN_BACKEND_INTERNAL_KEY ||
                env_1.env.MAIN_BACKEND_API_KEY ||
                undefined;
    }
    async getQuizMetadata(quizId, accessToken) {
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
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(quizId)}/metadata`;
        const response = await this.request(url, {
            method: 'GET',
            accessToken,
        });
        const rawData = this.unwrapResponse(response);
        const data = this.normalizeQuizMetadata(rawData);
        if (!data.id || !data.quizId || typeof data.questionCount !== 'number') {
            logger_1.logger.warn({
                quizId,
                data,
                rawData,
            }, 'Invalid quiz metadata response from main backend');
            throw new custom_error_1.CustomError('Invalid quiz metadata response', 502, 'INVALID_MAIN_BACKEND_RESPONSE');
        }
        if (data.questionCount <= 0) {
            throw new custom_error_1.CustomError('Quiz has no questions', 400, 'QUIZ_HAS_NO_QUESTIONS');
        }
        if (data.isPublished === false) {
            throw new custom_error_1.CustomError('Quiz is not available', 403, 'QUIZ_NOT_AVAILABLE');
        }
        if (data.playable === false) {
            throw new custom_error_1.CustomError('Quiz is not playable', 400, 'QUIZ_NOT_PLAYABLE');
        }
        return data;
    }
    async addQuizMember(params) {
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
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(params.quizId)}/members`;
        await this.request(url, {
            method: 'POST',
            accessToken: params.accessToken,
            body: {
                userId: params.userId,
                role: params.role,
            },
        });
    }
    async dispatchFlow(action, payload = {}, accessToken) {
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
        return this.unwrapResponse(response);
    }
    async getUserInfo(accessToken) {
        const data = await this.dispatchFlow('get_user_info', {}, accessToken);
        if (!data || typeof data !== 'object') {
            logger_1.logger.warn({
                data,
            }, 'Invalid get_user_info response from main backend');
            throw new custom_error_1.CustomError('Invalid user info response', 502, 'INVALID_MAIN_BACKEND_RESPONSE');
        }
        if (data.id === undefined ||
            data.id === null ||
            data.id === '') {
            logger_1.logger.warn({
                data,
            }, 'get_user_info response does not contain a valid user id');
            throw new custom_error_1.CustomError('Invalid user info response', 502, 'INVALID_MAIN_BACKEND_RESPONSE');
        }
        return data;
    }
    async gradeQuizSubmission(params) {
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
        const url = `${this.baseUrl}/internal/quizzes/${encodeURIComponent(params.quizId)}/grade`;
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
        const data = this.unwrapResponse(response);
        if (!data ||
            typeof data.score !== 'number' ||
            typeof data.total !== 'number' ||
            typeof data.correctCount !== 'number' ||
            typeof data.wrongCount !== 'number') {
            logger_1.logger.warn({
                quizId: params.quizId,
                userId: params.userId,
                data,
            }, 'Invalid quiz grading response from main backend');
            throw new custom_error_1.CustomError('Invalid quiz grading response', 502, 'INVALID_MAIN_BACKEND_RESPONSE');
        }
        return data;
    }
    async saveQuizResult(params) {
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
            return response;
        }
        catch (err) {
            /**
             * Saving result may be optional depending on your main backend.
             *
             * If saving is mandatory, remove this catch and let the error bubble.
             */
            logger_1.logger.warn({
                err,
                quizId: params.quizId,
                userId: params.userId,
                lobbyCode: params.lobbyCode,
            }, 'Failed to save result to main backend');
            return { success: false };
        }
    }
    async setQuizFinished(quizId, accessToken) {
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
        }
        catch (err) {
            logger_1.logger.warn({
                err,
                quizId,
            }, 'Failed to notify main backend of quiz finish');
            // Do not re-throw — callers handle this gracefully
        }
    }
    async request(url, options) {
        const headers = {
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
                body: options.body === undefined
                    ? undefined
                    : JSON.stringify(options.body),
                signal: controller.signal,
            });
            const responseBody = await this.parseResponseBody(response);
            if (!response.ok) {
                const message = this.extractErrorMessage(responseBody, 'Main backend request failed');
                logger_1.logger.warn({
                    url,
                    method: options.method,
                    status: response.status,
                    responseBody,
                }, 'Main backend request failed');
                throw new custom_error_1.CustomError(message, response.status >= 500 ? 502 : response.status, 'MAIN_BACKEND_REQUEST_FAILED', responseBody);
            }
            return responseBody;
        }
        catch (err) {
            if (err instanceof custom_error_1.CustomError) {
                throw err;
            }
            const isAbortError = err instanceof Error && err.name === 'AbortError';
            logger_1.logger.error({
                err,
                url,
                method: options.method,
                timeout: isAbortError,
            }, isAbortError
                ? 'Main backend request timed out'
                : 'Main backend request error');
            throw new custom_error_1.CustomError(isAbortError
                ? 'Main backend request timed out'
                : 'Main backend unavailable', 502, isAbortError
                ? 'MAIN_BACKEND_TIMEOUT'
                : 'MAIN_BACKEND_UNAVAILABLE');
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async parseResponseBody(response) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            }
            catch {
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
    unwrapResponse(response) {
        if (response &&
            typeof response === 'object' &&
            'success' in response &&
            'data' in response) {
            const envelope = response;
            if (envelope.success === false) {
                const message = envelope.error?.message ||
                    envelope.message ||
                    'Main backend returned an error';
                throw new custom_error_1.CustomError(message, 502, envelope.error?.code || 'MAIN_BACKEND_ERROR', response);
            }
            return envelope.data;
        }
        return response;
    }
    normalizeQuizMetadata(rawData) {
        if (!rawData || typeof rawData !== 'object') {
            return {
                id: '',
                questionCount: 0,
            };
        }
        const idValue = rawData.id ?? rawData.quizId;
        const quizIdValue = rawData.quizId ?? rawData.id;
        const questionCountValue = rawData.questionCount ??
            rawData.totalQuestions ??
            rawData.questionsCount ??
            rawData.question_count;
        const durationSecondsValue = rawData.durationSeconds ??
            rawData.duration_seconds ??
            rawData.timeLimit ??
            rawData.time_limit;
        const ownerIdValue = rawData.ownerId ??
            rawData.creatorId ??
            rawData.owner_id ??
            rawData.creator_id;
        return {
            id: String(idValue ?? ''),
            quizId: quizIdValue === undefined ? undefined : String(quizIdValue),
            shareCode: rawData.shareCode === undefined
                ? rawData.share_code === undefined
                    ? undefined
                    : String(rawData.share_code)
                : String(rawData.shareCode),
            title: rawData.title === undefined ? undefined : String(rawData.title),
            questionCount: this.toNumber(questionCountValue, 0),
            totalQuestions: this.toOptionalNumber(rawData.totalQuestions ?? rawData.questionCount),
            durationSeconds: this.toOptionalNumber(durationSecondsValue),
            ownerId: ownerIdValue === undefined ? undefined : String(ownerIdValue),
            creatorId: rawData.creatorId === undefined &&
                rawData.creator_id === undefined
                ? undefined
                : String(rawData.creatorId ?? rawData.creator_id),
            isPublished: typeof rawData.isPublished === 'boolean'
                ? rawData.isPublished
                : typeof rawData.is_published === 'boolean'
                    ? rawData.is_published
                    : undefined,
            playable: typeof rawData.playable === 'boolean'
                ? rawData.playable
                : undefined,
        };
    }
    extractErrorMessage(responseBody, fallback) {
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
            const body = responseBody;
            if (typeof body.error?.message === 'string') {
                return body.error.message;
            }
            if (typeof body.message === 'string') {
                return body.message;
            }
        }
        return fallback;
    }
    toNumber(value, fallback) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return fallback;
        }
        return numberValue;
    }
    toOptionalNumber(value) {
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
exports.MainBackendService = MainBackendService;
exports.mainBackendService = new MainBackendService();
