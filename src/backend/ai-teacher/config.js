'use strict';

/**
 * Met — AI subsystem configuration.
 *
 * Everything is driven by environment variables (see .env.example). The whole
 * subsystem can be switched off with AI_ENABLED=false; each optional
 * capability has its own flag and degrades gracefully when disabled or when
 * its model/provider is not configured. Provider keys never leave the server.
 */

const bool = (value, fallback) => {
    if (value == null || value === '') return fallback;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
};
const num = (value, fallback, { min = -Infinity, max = Infinity } = {}) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};
const env = (...names) => {
    for (const name of names) {
        const v = process.env[name];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
};

// ─── Master switch ───────────────────────────────────────────────────────────
const AI_ENABLED = bool(process.env.AI_ENABLED, true);

// ─── Provider (OpenAI-compatible; default GapGPT) ────────────────────────────
const PROVIDER = Object.freeze({
    name: env('AI_PROVIDER', 'AI_PROVIDER_NAME') || 'gapgpt',
    baseUrl: (env('AI_BASE_URL', 'AI_PROVIDER_BASE_URL', 'GAPGPT_BASE_URL') || 'https://api.gapgpt.app/v1').replace(/\/$/, ''),
    apiKey: env('AI_API_KEY', 'GAPGPT_API_KEY', 'AI_PROVIDER_API_KEY', 'OPENAI_API_KEY'),
    timeoutMs: num(process.env.AI_TIMEOUT_MS || process.env.AI_TEACHER_TIMEOUT_MS, 90000, { min: 5000 }),
    includeStreamUsage: bool(process.env.AI_STREAM_USAGE ?? process.env.AI_PROVIDER_STREAM_USAGE, true),
});

// ─── Models: one per capability ──────────────────────────────────────────────
const ENV_MODELS = Object.freeze({
    text: env('AI_TEXT_MODEL', 'AI_TEACHER_MODEL', 'GAPGPT_MODEL') || 'gpt-5.6-luna',
    textFast: env('AI_TEXT_MODEL_FAST', 'AI_TEACHER_MODEL_LOW') || 'gpt-5.6-luna',
    textDeep: env('AI_TEXT_MODEL_DEEP') || env('AI_TEXT_MODEL', 'AI_TEACHER_MODEL') || 'gpt-5.6-terra',
    utility: env('AI_UTILITY_MODEL', 'AI_TEACHER_MODEL_MEMORY') || 'gpt-5.6-luna',
    vision: env('AI_VISION_MODEL', 'AI_TEACHER_MODEL_VISION') || 'gpt-5.6-terra',
    tools: env('AI_TOOLS_MODEL', 'AI_TEACHER_MODEL_TOOLS') || 'gpt-5.6-terra',
    embedding: env('AI_EMBEDDING_MODEL', 'AI_TEACHER_EMBEDDING_MODEL') || 'text-embedding-3-small',
    image: env('AI_IMAGE_MODEL', 'AI_TEACHER_IMAGE_MODEL') || 'dall-e-3',
    stt: env('AI_STT_MODEL', 'AI_TEACHER_STT_MODEL') || 'whisper-1',
    tts: env('AI_TTS_MODEL', 'AI_TEACHER_TTS_MODEL') || 'tts-1',
    ttsVoice: env('AI_TTS_VOICE', 'AI_TEACHER_TTS_VOICE') || 'alloy',
});

// ─── Feature flags (opt-out; each also needs its model + provider) ───────────
const ENV_FLAGS = Object.freeze({
    chat: bool(process.env.AI_CHAT_ENABLED, true),
    vision: bool(process.env.AI_VISION_ENABLED ?? process.env.AI_TEACHER_ENABLE_VISION, true),
    imageGeneration: bool(process.env.AI_IMAGE_GENERATION_ENABLED ?? process.env.AI_TEACHER_ENABLE_IMAGE_GEN, true),
    stt: bool(process.env.AI_STT_ENABLED ?? process.env.AI_TEACHER_ENABLE_VOICE, true),
    tts: bool(process.env.AI_TTS_ENABLED ?? process.env.AI_TEACHER_ENABLE_VOICE, true),
    pdfReferences: bool(process.env.AI_PDF_REFERENCES_ENABLED ?? process.env.AI_TEACHER_ENABLE_RAG, true),
    memory: bool(process.env.AI_MEMORY_ENABLED, true),
    knowledgeBase: bool(process.env.AI_KNOWLEDGE_BASE_ENABLED, true),
    tools: bool(process.env.AI_TOOLS_ENABLED ?? process.env.AI_TEACHER_ENABLE_TOOLS, true),
    suggestions: bool(process.env.AI_SUGGESTIONS_ENABLED, true),
});

/**
 * Admin-editable overlay (tam24_ai_admin_settings). Env remains the default;
 * DB values win when present. API keys are never stored here.
 */
let overlay = {};

function overlayBucket(name, base) {
    return new Proxy(base, {
        get(target, prop, receiver) {
            if (prop === '__base') return target;
            if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
            const extra = overlay[name];
            if (extra && Object.prototype.hasOwnProperty.call(extra, prop) && extra[prop] !== undefined && extra[prop] !== null) {
                return extra[prop];
            }
            return target[prop];
        },
        ownKeys(target) {
            return [...new Set([...Reflect.ownKeys(target), ...Object.keys(overlay[name] || {})])];
        },
        getOwnPropertyDescriptor(target, prop) {
            if (prop in target || (overlay[name] && prop in overlay[name])) {
                return { enumerable: true, configurable: true, writable: false };
            }
            return undefined;
        },
    });
}

const MODELS = overlayBucket('models', ENV_MODELS);
const FLAGS = overlayBucket('flags', ENV_FLAGS);

function applyRuntimeOverlay(next) {
    overlay = next && typeof next === 'object' ? next : {};
}

function getRuntimeOverlay() {
    return overlay;
}

function isMasterEnabled() {
    if (overlay.flags && overlay.flags.aiEnabled === false) return false;
    if (overlay.flags && overlay.flags.aiEnabled === true) return true;
    return AI_ENABLED;
}

const providerConfigured = () => isMasterEnabled() && !!PROVIDER.apiKey && !!PROVIDER.baseUrl;

/**
 * Effective capability matrix: flag on AND everything it depends on is
 * configured. This is what the frontend receives — never raw env values.
 */
function featureStatus() {
    const ok = providerConfigured();
    return {
        aiAvailable: ok && FLAGS.chat,
        chat: ok && FLAGS.chat,
        vision: ok && FLAGS.vision && !!MODELS.vision,
        imageGeneration: ok && FLAGS.imageGeneration && !!MODELS.image,
        stt: ok && FLAGS.stt && !!MODELS.stt,
        tts: ok && FLAGS.tts && !!MODELS.tts,
        pdfReferences: ok && FLAGS.pdfReferences,
        memory: ok && FLAGS.memory,
        knowledgeBase: FLAGS.knowledgeBase,
        tools: ok && FLAGS.tools && !!MODELS.tools,
        suggestions: FLAGS.suggestions,
        embeddings: ok && !!MODELS.embedding,
    };
}

/** Why the AI is unavailable — safe to show to admins in logs, never with key material. */
function unavailableReason() {
    if (!isMasterEnabled()) return 'AI_DISABLED';
    if (!PROVIDER.apiKey) return 'AI_NOT_CONFIGURED';
    if (!FLAGS.chat) return 'AI_CHAT_DISABLED';
    return null;
}

// ─── Coins ───────────────────────────────────────────────────────────────────
/**
 * Coins are the student's currency; provider tokens are the provider's.
 * 1 coin = IRR_PER_COIN rials of real provider cost (default 100 IRR).
 * The daily grant resets every local calendar day and never rolls over;
 * purchased coins never expire.
 */
const USD_TO_IRR = num(process.env.AI_USD_TO_IRR || process.env.AI_TEACHER_USD_TO_IRR, 1_000_000, { min: 1 });
const IRR_PER_COIN = num(process.env.AI_IRR_PER_COIN || process.env.AI_TEACHER_IRR_PER_ENERGY, 100, { min: 1 });

const DEFAULT_DAILY_FREE = num(process.env.AI_DAILY_FREE_COINS, 80, { min: 0 });
const ENV_DAILY_COINS_BY_PLAN = Object.freeze({
    free: DEFAULT_DAILY_FREE,
    bronze: num(process.env.AI_DAILY_COINS_BRONZE, 300, { min: 0 }),
    silver: num(process.env.AI_DAILY_COINS_SILVER, 500, { min: 0 }),
    golden: num(process.env.AI_DAILY_COINS_GOLDEN, 1000, { min: 0 }),
    diamond: num(process.env.AI_DAILY_COINS_DIAMOND, 1500, { min: 0 }),
    epic: num(process.env.AI_DAILY_COINS_EPIC, 1500, { min: 0 }),
    premium: num(process.env.AI_DAILY_COINS_PREMIUM, 800, { min: 0 }),
});
const DAILY_COINS_BY_PLAN = overlayBucket('dailyCoins', ENV_DAILY_COINS_BY_PLAN);

const ENV_COIN_PRICING = Object.freeze({
    minCharge: 1,
    minBalanceToStart: 1,
    defaultReservation: 20,
    usdToIrr: USD_TO_IRR,
    irrPerCoin: IRR_PER_COIN,
});
const COIN_PRICING = overlayBucket('coinPricing', ENV_COIN_PRICING);

/** Flat coin prices for non-token operations (on top of any token cost). */
const ENV_FLAT_COIN_COSTS = Object.freeze({
    image: num(process.env.AI_IMAGE_COIN_COST || process.env.AI_TEACHER_IMAGE_ENERGY_COST, 40, { min: 0 }),
    stt: num(process.env.AI_STT_COIN_COST || process.env.AI_TEACHER_STT_ENERGY_COST, 2, { min: 0 }),
    tts: num(process.env.AI_TTS_COIN_COST || process.env.AI_TEACHER_TTS_ENERGY_COST, 6, { min: 0 }),
    pdfIndex: num(process.env.AI_PDF_INDEX_COIN_COST, 0, { min: 0 }),
});
const FLAT_COIN_COSTS = overlayBucket('flatCosts', ENV_FLAT_COIN_COSTS);

/**
 * Fallback provider list prices (USD per 1M tokens) used when
 * tam24_ai_model_pricing has no row for a model. Source: GapGPT (Aug 2026).
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
    'text-embedding-3-small': { input: 0.02, cache: 0, output: 0 },
    'text-embedding-3-large': { input: 0.13, cache: 0, output: 0 },
});

/** Flat provider USD for per-unit operations (fallback when no DB row). */
const UNIT_PRICES_USD = Object.freeze({
    'dall-e-3': 0.04,
    'gpt-image-1': 0.04,
    'whisper-1': 0.006, // per minute
    'tts-1': 0.015, // per 1K chars
    'tts-1-hd': 0.03,
});

// ─── Context / limits ────────────────────────────────────────────────────────
const ENV_CONTEXT_LIMITS = Object.freeze({
    recentMessages: 14,
    maxMemoryItems: 8,
    summarizeAfterMessages: 24,
    maxUserMessageChars: 4000,
    titleMaxChars: 60,
    ragTopK: 4,
    ragMaxChars: 2600,
    knowledgeTopK: 3,
    knowledgeMaxChars: 2200,
    maxAttachmentsPerMessage: 3,
    maxToolCallsPerTurn: 3,
});
const CONTEXT_LIMITS = overlayBucket('contextLimits', ENV_CONTEXT_LIMITS);

const ENV_FILE_LIMITS = Object.freeze({
    imageMb: num(process.env.AI_MAX_IMAGE_MB, 8, { min: 1, max: 50 }),
    audioMb: num(process.env.AI_MAX_AUDIO_MB, 15, { min: 1, max: 100 }),
    pdfMb: num(process.env.AI_MAX_PDF_MB, 30, { min: 1, max: 200 }),
    maxPdfsPerConversation: num(process.env.AI_MAX_PDFS_PER_CONVERSATION, 4, { min: 1, max: 10 }),
    maxPdfPages: num(process.env.AI_MAX_PDF_PAGES, 600, { min: 10 }),
    uploadRoot: env('AI_UPLOAD_ROOT') || null,
});
const FILE_LIMITS = overlayBucket('fileLimits', ENV_FILE_LIMITS);

const ENV_RATE_LIMITS = Object.freeze({
    chatPerMinute: num(process.env.AI_RATE_LIMIT_CHAT_PER_MINUTE, 20, { min: 1 }),
    uploadsPerMinute: num(process.env.AI_RATE_LIMIT_UPLOADS_PER_MINUTE, 15, { min: 1 }),
    voicePerMinute: num(process.env.AI_RATE_LIMIT_VOICE_PER_MINUTE, 15, { min: 1 }),
});
const RATE_LIMITS = overlayBucket('rateLimits', ENV_RATE_LIMITS);

const SUGGESTIONS = Object.freeze({
    servePerSubject: 4,
    poolPerSubject: 10,
});

function dailyCoinsForPlan(planKey) {
    const key = String(planKey || 'free').toLowerCase();
    return DAILY_COINS_BY_PLAN[key] ?? DAILY_COINS_BY_PLAN.free;
}

/**
 * Calendar date in the server's local timezone as YYYY-MM-DD.
 * Never use toISOString() for daily keys (UTC would skip/repeat days in Iran).
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

function fallbackModelPrices(modelId) {
    const key = String(modelId || MODELS.text).toLowerCase();
    return MODEL_PRICES_USD_PER_1M[key] || MODEL_PRICES_USD_PER_1M[MODELS.text] || { input: 0.2, cache: 0.02, output: 1.2 };
}

function snapshotRuntimeSettings() {
    const pick = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => (k === '__base' ? undefined : v)));
    return {
        flags: { aiEnabled: isMasterEnabled(), ...pick({ ...ENV_FLAGS, ...overlay.flags }) },
        models: { ...ENV_MODELS, ...(overlay.models || {}) },
        dailyCoins: { ...ENV_DAILY_COINS_BY_PLAN, ...(overlay.dailyCoins || {}) },
        coinPricing: { ...ENV_COIN_PRICING, ...(overlay.coinPricing || {}) },
        flatCosts: { ...ENV_FLAT_COIN_COSTS, ...(overlay.flatCosts || {}) },
        contextLimits: { ...ENV_CONTEXT_LIMITS, ...(overlay.contextLimits || {}) },
        fileLimits: { ...ENV_FILE_LIMITS, ...(overlay.fileLimits || {}) },
        rateLimits: { ...ENV_RATE_LIMITS, ...(overlay.rateLimits || {}) },
        defaults: {
            flags: { aiEnabled: AI_ENABLED, ...ENV_FLAGS },
            models: { ...ENV_MODELS },
            dailyCoins: { ...ENV_DAILY_COINS_BY_PLAN },
            coinPricing: { ...ENV_COIN_PRICING },
            flatCosts: { ...ENV_FLAT_COIN_COSTS },
            contextLimits: { ...ENV_CONTEXT_LIMITS },
            fileLimits: { ...ENV_FILE_LIMITS },
            rateLimits: { ...ENV_RATE_LIMITS },
        },
        provider: {
            name: PROVIDER.name,
            baseUrl: PROVIDER.baseUrl,
            apiKeyConfigured: !!PROVIDER.apiKey,
            timeoutMs: PROVIDER.timeoutMs,
        },
    };
}

module.exports = {
    AI_ENABLED,
    PROVIDER,
    MODELS,
    FLAGS,
    featureStatus,
    unavailableReason,
    providerConfigured,
    isMasterEnabled,
    applyRuntimeOverlay,
    getRuntimeOverlay,
    snapshotRuntimeSettings,
    DAILY_COINS_BY_PLAN,
    COIN_PRICING,
    FLAT_COIN_COSTS,
    MODEL_PRICES_USD_PER_1M,
    UNIT_PRICES_USD,
    CONTEXT_LIMITS,
    FILE_LIMITS,
    RATE_LIMITS,
    SUGGESTIONS,
    dailyCoinsForPlan,
    localDateString,
    fallbackModelPrices,
    // Backward-compatible aliases (older modules/tests)
    DAILY_REFILL_BY_PLAN: DAILY_COINS_BY_PLAN,
    dailyRefillForPlan: dailyCoinsForPlan,
    modelPrices: fallbackModelPrices,
};
