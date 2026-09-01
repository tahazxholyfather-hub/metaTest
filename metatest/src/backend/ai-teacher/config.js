'use strict';

/**
 * Met — AI tutor server configuration.
 * Default provider: GapGPT (OpenAI-compatible) https://api.gapgpt.app/v1
 *
 * Energy is billed from real USD API cost → IRR → integer energy.
 * Set AI_TEACHER_USD_TO_IRR to the live unofficial USD/IRR rate you want to book at.
 */

const DAILY_REFILL_BY_PLAN = Object.freeze({
    // Integer energy. 1 energy = IRR_PER_ENERGY rials of API cost (default 100 IRR).
    free: 80,
    bronze: 300,
    silver: 500,
    golden: 1000,
    diamond: 1500,
    epic: 1500,
    premium: 800,
});

const USD_TO_IRR = Math.max(1, Number(process.env.AI_TEACHER_USD_TO_IRR || 1_000_000));
const IRR_PER_ENERGY = Math.max(1, Number(process.env.AI_TEACHER_IRR_PER_ENERGY || 100));

/**
 * GapGPT / OpenAI / Anthropic list prices (USD per 1M tokens).
 * Source: GapGPT hosted pricing table (Aug 2026).
 */
const MODEL_PRICES_USD_PER_1M = Object.freeze({
    'gapgpt-qwen-3.6': { input: 0.25, cache: 0, output: 2.0 },
    'gapgpt-qwen-3.6-thinking': { input: 0.25, cache: 0, output: 2.0 },
    'gpt-5.6-sol': { input: 5.0, cache: 0.5, output: 30.0 },
    'gpt-5.6-luna': { input: 0.2, cache: 0.02, output: 1.2 },
    'gpt-5.6-terra': { input: 2.0, cache: 0.2, output: 12.0 },
    'gpt-5.5': { input: 5.0, cache: 0.5, output: 30.0 },
    'gpt-5.4': { input: 2.5, cache: 0.25, output: 15.0 },
    'gpt-5.2-pro': { input: 21.0, cache: 0, output: 168.0 },
    'gpt-5.3-codex-spark': { input: 1.75, cache: 0.18, output: 14.0 },
    'claude-fable-5': { input: 10.0, cache: 1.0, output: 50.0 },
    'claude-sonnet-5': { input: 2.0, cache: 0.2, output: 10.0 },
});

const COIN_PRICING = Object.freeze({
    minCharge: 1,
    minBalanceToStart: 1,
    defaultReservation: 20,
    usdToIrr: USD_TO_IRR,
    irrPerEnergy: IRR_PER_ENERGY,
});

const CONTEXT_LIMITS = Object.freeze({
    recentMessages: 14,
    maxMemoryItems: 8,
    summarizeAfterMessages: 24,
    maxUserMessageChars: 4000,
    titleMaxChars: 60,
    ragTopK: 4,
    ragMaxChars: 2600,
});

const MODELS = Object.freeze({
    default: process.env.AI_TEACHER_MODEL || process.env.GAPGPT_MODEL || 'gpt-5.6-luna',
    lowCost: process.env.AI_TEACHER_MODEL_LOW || process.env.GAPGPT_MODEL_LOW || 'gpt-5.6-luna',
    memory: process.env.AI_TEACHER_MODEL_MEMORY || process.env.GAPGPT_MODEL_MEMORY || 'gpt-5.6-luna',
    vision: process.env.AI_TEACHER_MODEL_VISION || process.env.GAPGPT_MODEL_VISION || 'gpt-5.6-terra',
    tools: process.env.AI_TEACHER_MODEL_TOOLS || process.env.GAPGPT_MODEL_TOOLS || 'gpt-5.6-terra',
    embedding: process.env.AI_TEACHER_EMBEDDING_MODEL || process.env.GAPGPT_EMBEDDING_MODEL || 'text-embedding-3-small',
    image: process.env.AI_TEACHER_IMAGE_MODEL || process.env.GAPGPT_IMAGE_MODEL || 'dall-e-3',
});

const PROVIDER = Object.freeze({
    name: process.env.AI_PROVIDER_NAME || 'gapgpt',
    baseUrl: (process.env.AI_PROVIDER_BASE_URL || process.env.GAPGPT_BASE_URL || 'https://api.gapgpt.app/v1')
        .replace(/\/$/, ''),
    apiKey:
        process.env.GAPGPT_API_KEY ||
        process.env.AI_PROVIDER_API_KEY ||
        process.env.OPENAI_API_KEY ||
        '',
    timeoutMs: Number(process.env.AI_TEACHER_TIMEOUT_MS || 90000),
    includeStreamUsage: String(process.env.AI_PROVIDER_STREAM_USAGE || 'true').toLowerCase() !== 'false',
});

/** Feature toggles — fail soft to plain streaming if the gateway rejects a param. */
const FEATURES = Object.freeze({
    tools: String(process.env.AI_TEACHER_ENABLE_TOOLS || 'true').toLowerCase() !== 'false',
    imageGeneration: String(process.env.AI_TEACHER_ENABLE_IMAGE_GEN || 'true').toLowerCase() !== 'false',
    vision: String(process.env.AI_TEACHER_ENABLE_VISION || 'true').toLowerCase() !== 'false',
    rag: String(process.env.AI_TEACHER_ENABLE_RAG || 'true').toLowerCase() !== 'false',
});

/** Flat energy surcharge for a Met-generated image (on top of token cost). */
const IMAGE_ENERGY_COST = Math.max(0, Number(process.env.AI_TEACHER_IMAGE_ENERGY_COST || 40));

function dailyRefillForPlan(planKey) {
    const key = String(planKey || 'free').toLowerCase();
    return DAILY_REFILL_BY_PLAN[key] ?? DAILY_REFILL_BY_PLAN.free;
}

/**
 * Calendar date in the server's local timezone as YYYY-MM-DD.
 * Never use toISOString() for refill keys (UTC would skip/repeat days in Iran).
 */
function localDateString(value = new Date()) {
    if (value == null) return null;
    if (typeof value === 'string') {
        const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        value = parsed;
    }
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function modelPrices(modelId) {
    const key = String(modelId || MODELS.default).toLowerCase();
    return MODEL_PRICES_USD_PER_1M[key] || MODEL_PRICES_USD_PER_1M[MODELS.default] || {
        input: 0.2,
        cache: 0.02,
        output: 1.2,
    };
}

module.exports = {
    DAILY_REFILL_BY_PLAN,
    MODEL_PRICES_USD_PER_1M,
    COIN_PRICING,
    CONTEXT_LIMITS,
    MODELS,
    PROVIDER,
    FEATURES,
    IMAGE_ENERGY_COST,
    dailyRefillForPlan,
    localDateString,
    modelPrices,
};
