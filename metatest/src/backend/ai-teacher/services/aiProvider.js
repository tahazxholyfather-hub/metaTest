'use strict';

const { PROVIDER, MODELS } = require('../config');

/**
 * Provider abstraction — OpenAI-compatible Chat Completions API.
 * Default test target: GapGPT (https://api.gapgpt.app/v1)
 */

class AiProviderError extends Error {
    constructor(message, code = 'AI_PROVIDER_ERROR', status = 502) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

function assertConfigured() {
    if (!PROVIDER.apiKey) {
        throw new AiProviderError(
            'سرویس هوش مصنوعی پیکربندی نشده است. GAPGPT_API_KEY را تنظیم کنید.',
            'AI_NOT_CONFIGURED',
            503
        );
    }
}

function buildBody({ messages, model, maxTokens, temperature, stream }) {
    const body = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: !!stream,
    };

    // Only send when explicitly enabled — GapGPT may reject unknown fields
    if (stream && PROVIDER.includeStreamUsage) {
        body.stream_options = { include_usage: true };
    }

    return body;
}

function extractErrorMessage(data, fallback) {
    return (
        data?.error?.message ||
        data?.message ||
        data?.error ||
        fallback
    );
}

function extractUsage(json, fallback = null) {
    const usage = json?.usage;
    if (!usage) return fallback;
    const cached =
        usage.prompt_tokens_details?.cached_tokens
        || usage.cached_tokens
        || usage.prompt_cache_hit_tokens
        || 0;
    const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    if (!inputTokens && !outputTokens && !totalTokens) return fallback;
    return {
        inputTokens,
        outputTokens,
        totalTokens,
        cachedTokens: Number(cached) || 0,
    };
}

function estimateTokensFromText(text) {
    const s = String(text || '');
    if (!s) return 0;
    const persian = (s.match(/[\u0600-\u06FF]/g) || []).length;
    const other = Math.max(0, s.length - persian);
    return Math.ceil(persian / 1.8 + other / 4);
}

function estimateUsage(messages, fullText) {
    const inText = Array.isArray(messages)
        ? messages.map((m) => (m && m.content) || '').join('\n')
        : JSON.stringify(messages || '');
    const inputTokens = Math.max(1, estimateTokensFromText(inText));
    const outputTokens = Math.max(1, estimateTokensFromText(fullText));
    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedTokens: 0,
        estimated: true,
    };
}

async function generate({ messages, model, maxTokens, temperature = 0.6 }) {
    assertConfigured();
    const usedModel = model || MODELS.default;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER.timeoutMs);

    try {
        const res = await fetch(`${PROVIDER.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PROVIDER.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildBody({
                messages,
                model: usedModel,
                maxTokens,
                temperature,
                stream: false,
            })),
            signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new AiProviderError(
                extractErrorMessage(data, 'خطا در سرویس هوش مصنوعی'),
                'AI_PROVIDER_ERROR',
                res.status
            );
        }

        const content = data?.choices?.[0]?.message?.content || '';
        const usage = extractUsage(data) || estimateUsage(messages, content);
        return {
            content,
            model: data?.model || usedModel,
            usage,
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new AiProviderError('زمان پاسخ‌گویی به پایان رسید.', 'AI_TIMEOUT', 504);
        }
        if (err instanceof AiProviderError) throw err;
        throw new AiProviderError(err.message || 'خطای شبکه هوش مصنوعی', 'AI_NETWORK', 502);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Stream chat completion. Yields { type: 'delta'|'done', ... }
 */
async function* stream({ messages, model, maxTokens, temperature = 0.6 }) {
    assertConfigured();
    const usedModel = model || MODELS.default;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER.timeoutMs);

    let res;
    try {
        res = await fetch(`${PROVIDER.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PROVIDER.apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify(buildBody({
                messages,
                model: usedModel,
                maxTokens,
                temperature,
                stream: true,
            })),
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new AiProviderError('زمان پاسخ‌گویی به پایان رسید.', 'AI_TIMEOUT', 504);
        }
        throw new AiProviderError(err.message || 'خطای شبکه هوش مصنوعی', 'AI_NETWORK', 502);
    }

    if (!res.ok) {
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        throw new AiProviderError(
            extractErrorMessage(data, 'خطا در سرویس هوش مصنوعی'),
            'AI_PROVIDER_ERROR',
            res.status
        );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0 };
    let fullText = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split('\n');
            buffer = parts.pop() || '';

            for (const line of parts) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;

                let json;
                try {
                    json = JSON.parse(payload);
                } catch {
                    continue;
                }

                const delta = json?.choices?.[0]?.delta?.content || '';
                if (delta) {
                    fullText += delta;
                    yield { type: 'delta', text: delta };
                }

                const parsedUsage = extractUsage(json);
                if (parsedUsage) usage = parsedUsage;
            }
        }
    } finally {
        clearTimeout(timer);
        try { reader.releaseLock(); } catch { /* ignore */ }
    }

    if (!usage.totalTokens || (!usage.inputTokens && !usage.outputTokens)) {
        usage = estimateUsage(messages, fullText);
    }

    yield {
        type: 'done',
        content: fullText,
        model: usedModel,
        usage,
    };
}

module.exports = {
    generate,
    stream,
    AiProviderError,
    estimateUsage,
    extractUsage,
};
