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
            'سرویس هوش مصنوعی پیکربندی نشده است. AI_API_KEY را تنظیم کنید.',
            'AI_NOT_CONFIGURED',
            503
        );
    }
}

function buildBody({ messages, model, maxTokens, temperature, stream, tools, toolChoice }) {
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

    if (Array.isArray(tools) && tools.length) {
        body.tools = tools;
        body.tool_choice = toolChoice || 'auto';
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
        ? messages.map((m) => textOf(m && m.content)).join('\n')
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

/** Chat `content` can be a plain string or an array of {type, text|image_url} parts. */
function textOf(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => (part && part.type === 'text' ? part.text : ''))
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

async function fetchJson(path, { method = 'POST', body, timeoutMs = PROVIDER.timeoutMs } = {}) {
    assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${PROVIDER.baseUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${PROVIDER.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
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
        return data;
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

async function generate({ messages, model, maxTokens, temperature = 0.6, tools, toolChoice }) {
    const usedModel = model || MODELS.text;
    const data = await fetchJson('/chat/completions', {
        body: buildBody({ messages, model: usedModel, maxTokens, temperature, stream: false, tools, toolChoice }),
    });

    const choice = data?.choices?.[0];
    const content = choice?.message?.content || '';
    const toolCalls = choice?.message?.tool_calls || null;
    const usage = extractUsage(data) || estimateUsage(messages, content);
    return {
        content,
        toolCalls,
        model: data?.model || usedModel,
        usage,
    };
}

/**
 * Stream chat completion. Yields { type: 'delta'|'done', ... }
 */
async function* stream({ messages, model, maxTokens, temperature = 0.6, signal = null }) {
    assertConfigured();
    const usedModel = model || MODELS.text;

    const controller = new AbortController();
    // Idle timeout: reset on every received chunk so a long but healthy
    // stream is not killed by a wall-clock timer. User abort is separate.
    const idleMs = PROVIDER.timeoutMs;
    let timer = setTimeout(() => controller.abort(), idleMs);
    const bumpIdle = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), idleMs);
    };
    let stopped = false;
    const onExternalAbort = () => { stopped = true; controller.abort(); };
    if (signal) {
        if (signal.aborted) onExternalAbort();
        else signal.addEventListener('abort', onExternalAbort, { once: true });
    }

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
        if (signal) signal.removeEventListener('abort', onExternalAbort);
        if (err.name === 'AbortError') {
            if (stopped) throw new AiProviderError('تولید پاسخ متوقف شد.', 'AI_STOPPED', 499);
            throw new AiProviderError('زمان پاسخ‌گویی به پایان رسید.', 'AI_TIMEOUT', 504);
        }
        throw new AiProviderError(err.message || 'خطای شبکه هوش مصنوعی', 'AI_NETWORK', 502);
    }

    if (!res.ok) {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
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
    let finishReason = null;

    try {
        while (true) {
            let chunk;
            try {
                chunk = await reader.read();
            } catch (err) {
                if (stopped) break;
                if (err.name === 'AbortError') throw new AiProviderError('زمان پاسخ‌گویی به پایان رسید.', 'AI_TIMEOUT', 504);
                throw new AiProviderError(err.message || 'خطای شبکه هوش مصنوعی', 'AI_NETWORK', 502);
            }
            const { done, value } = chunk;
            if (done) break;
            bumpIdle();
            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split(/\r?\n/);
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

                const reason = json?.choices?.[0]?.finish_reason;
                if (reason) finishReason = reason;

                const parsedUsage = extractUsage(json);
                if (parsedUsage) usage = parsedUsage;
            }
        }
    } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
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
        stopped,
        finishReason,
    };
}

/**
 * Embeddings — used by ragService for chunk + query vectors.
 * Returns an array of float arrays, one per input string.
 */
async function embed({ input, model } = {}) {
    const inputs = Array.isArray(input) ? input : [input];
    if (!inputs.length) return [];
    const data = await fetchJson('/embeddings', {
        body: { model: model || MODELS.embedding, input: inputs },
    });
    const vectors = (data?.data || []).map((row) => row.embedding);
    return vectors;
}

/**
 * Speech-to-text (OpenAI-compatible /audio/transcriptions).
 * `audio` is a Buffer; returns the transcribed text.
 */
async function transcribe({ audio, filename = 'voice.webm', mimeType = 'audio/webm', model, language } = {}) {
    assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER.timeoutMs);
    try {
        const form = new FormData();
        form.append('file', new Blob([audio], { type: mimeType }), filename);
        form.append('model', model || MODELS.stt);
        if (language) form.append('language', language);

        const res = await fetch(`${PROVIDER.baseUrl}/audio/transcriptions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${PROVIDER.apiKey}` },
            body: form,
            signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new AiProviderError(extractErrorMessage(data, 'خطا در تبدیل گفتار به متن'), 'AI_STT_ERROR', res.status);
        }
        return String(data?.text || '').trim();
    } catch (err) {
        if (err.name === 'AbortError') throw new AiProviderError('زمان پاسخ‌گویی به پایان رسید.', 'AI_TIMEOUT', 504);
        if (err instanceof AiProviderError) throw err;
        throw new AiProviderError(err.message || 'خطای شبکه هوش مصنوعی', 'AI_NETWORK', 502);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Text-to-speech (OpenAI-compatible /audio/speech).
 * Returns an mp3 Buffer.
 */
async function speak({ text, model, voice, format = 'mp3' } = {}) {
    assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER.timeoutMs);
    try {
        const res = await fetch(`${PROVIDER.baseUrl}/audio/speech`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PROVIDER.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || MODELS.tts,
                voice: voice || MODELS.ttsVoice,
                input: String(text || '').slice(0, 3000),
                response_format: format,
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new AiProviderError(extractErrorMessage(data, 'خطا در تولید صدا'), 'AI_TTS_ERROR', res.status);
        }
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err) {
        if (err.name === 'AbortError') throw new AiProviderError('زمان پاسخ‌گویی به پایان رسید.', 'AI_TIMEOUT', 504);
        if (err instanceof AiProviderError) throw err;
        throw new AiProviderError(err.message || 'خطای شبکه هوش مصنوعی', 'AI_NETWORK', 502);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Image generation (OpenAI-compatible /images/generations).
 * Returns { url } or { b64 } depending on gateway response shape.
 */
async function generateImage({ prompt, model, size = '1024x1024' } = {}) {
    const data = await fetchJson('/images/generations', {
        body: { model: model || MODELS.image, prompt, size, n: 1 },
        timeoutMs: Math.max(PROVIDER.timeoutMs, 120000),
    });
    const item = data?.data?.[0];
    if (!item) throw new AiProviderError('تصویری ساخته نشد.', 'IMAGE_EMPTY', 502);
    return {
        url: item.url || null,
        b64: item.b64_json || null,
        revisedPrompt: item.revised_prompt || prompt,
    };
}

module.exports = {
    generate,
    stream,
    embed,
    generateImage,
    transcribe,
    speak,
    AiProviderError,
    estimateUsage,
    extractUsage,
    textOf,
};
