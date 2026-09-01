'use strict';

/**
 * AI Teacher server configuration.
 * Default provider: GapGPT (OpenAI-compatible) https://api.gapgpt.app/v1
 *
 * Energy is billed from real USD API cost → IRR → integer energy.
 * Set AI_TEACHER_USD_TO_IRR to the live unofficial USD/IRR rate you want to book at.
 */

const DAILY_REFILL_BY_PLAN = Object.freeze({
    // Integer energy. 1 energy = IRR_PER_ENERGY rials of API cost (default 100 IRR).
    // Luna ~10 energy/msg; terra ~120 energy/msg. Free users cannot stack days.
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
    recentMessages: 12,
    maxMemoryItems: 8,
    summarizeAfterMessages: 24,
    maxUserMessageChars: 4000,
    titleMaxChars: 60,
});

const MODELS = Object.freeze({
    default: process.env.AI_TEACHER_MODEL || process.env.GAPGPT_MODEL || 'gpt-5.6-luna',
    lowCost: process.env.AI_TEACHER_MODEL_LOW || process.env.GAPGPT_MODEL_LOW || 'gpt-5.6-luna',
    memory: process.env.AI_TEACHER_MODEL_MEMORY || process.env.GAPGPT_MODEL_MEMORY || 'gpt-5.6-luna',
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

function dailyRefillForPlan(planKey) {
    const key = String(planKey || 'free').toLowerCase();
    return DAILY_REFILL_BY_PLAN[key] ?? DAILY_REFILL_BY_PLAN.free;
}

function isPaidPlan(planKey) {
    const key = String(planKey || 'free').toLowerCase();
    return key !== 'free' && key !== 'none' && key !== '';
}

function planAllowsTeacher(planKey, teacher) {
    if (!teacher) return false;
    if (teacher.is_free || teacher.isFree) return true;
    return isPaidPlan(planKey);
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
    dailyRefillForPlan,
    isPaidPlan,
    planAllowsTeacher,
    localDateString,
    modelPrices,
};
