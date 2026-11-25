'use strict';

const {
    COIN_PRICING, MODELS, PROVIDER, FLAT_COIN_COSTS, UNIT_PRICES_USD, fallbackModelPrices,
} = require('../config');

/**
 * Cost accounting. Provider USD → IRR → integer coins (always rounded up).
 * Prices come from tam24_ai_model_pricing (cached 10 min) with the config
 * constants as fallback, so pricing can be tuned without a deploy.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
let priceCache = { at: 0, rows: new Map() };

function roundUsd(v) {
    return Math.round((Number(v) || 0) * 1e10) / 1e10;
}

async function loadPricingTable(db) {
    if (!db) return priceCache.rows;
    if (Date.now() - priceCache.at < CACHE_TTL_MS && priceCache.rows.size) return priceCache.rows;
    try {
        const [rows] = await db.query(
            `SELECT provider, model, operation_type, input_usd_per_1m, cached_usd_per_1m, output_usd_per_1m, unit_usd, flat_coin_cost
             FROM tam24_ai_model_pricing WHERE is_active = 1`
        );
        const map = new Map();
        for (const r of rows) {
            map.set(`${r.model}`.toLowerCase(), {
                input: Number(r.input_usd_per_1m) || 0,
                cache: Number(r.cached_usd_per_1m) || 0,
                output: Number(r.output_usd_per_1m) || 0,
                unit: Number(r.unit_usd) || 0,
                flatCoins: r.flat_coin_cost == null ? null : Number(r.flat_coin_cost),
                operationType: r.operation_type,
            });
        }
        priceCache = { at: Date.now(), rows: map };
    } catch {
        // Table missing (migration not run yet) — fall back to constants.
        priceCache = { at: Date.now(), rows: priceCache.rows };
    }
    return priceCache.rows;
}

function invalidatePricingCache() {
    priceCache = { at: 0, rows: new Map() };
}

function ratesFor(model) {
    const key = String(model || MODELS.text).toLowerCase();
    const row = priceCache.rows.get(key);
    if (row && (row.input || row.output || row.cache)) return { input: row.input, cache: row.cache, output: row.output };
    return fallbackModelPrices(key);
}

function unitUsdFor(model) {
    const key = String(model || '').toLowerCase();
    const row = priceCache.rows.get(key);
    if (row && row.unit) return row.unit;
    return UNIT_PRICES_USD[key] || 0;
}

function usdToCoins(usd) {
    const irr = Math.max(0, Math.round((Number(usd) || 0) * COIN_PRICING.usdToIrr));
    const coins = Math.ceil(irr / COIN_PRICING.irrPerCoin) || 0;
    return { irr, coins };
}

/**
 * Exact provider USD for token usage, then IRR + integer coins.
 * `extraCoins` adds flat surcharges (e.g. a generated image).
 */
function quoteUsage({ inputTokens = 0, outputTokens = 0, cachedTokens = 0, model = MODELS.text, extraCoins = 0, extraEnergy = 0 } = {}) {
    const rates = ratesFor(model);
    const inTok = Math.max(0, Number(inputTokens) || 0);
    const outTok = Math.max(0, Number(outputTokens) || 0);
    const cacheTok = Math.min(inTok, Math.max(0, Number(cachedTokens) || 0));
    const uncachedIn = inTok - cacheTok;

    const usd = roundUsd((uncachedIn / 1e6) * rates.input + (cacheTok / 1e6) * (rates.cache || 0) + (outTok / 1e6) * rates.output);
    const { irr, coins: baseCoins } = usdToCoins(usd);
    const coins = Math.max(COIN_PRICING.minCharge, baseCoins) + Math.max(0, Number(extraCoins) || 0) + Math.max(0, Number(extraEnergy) || 0);

    return {
        model: String(model || MODELS.text),
        provider: PROVIDER.name,
        rates,
        inputTokens: inTok,
        outputTokens: outTok,
        cachedTokens: cacheTok,
        usd,
        irr,
        coins,
        energy: coins, // legacy name
        exchangeRateIrr: COIN_PRICING.usdToIrr,
        irrPerCoin: COIN_PRICING.irrPerCoin,
    };
}

/** Provider USD for a per-unit operation (image count, audio seconds, TTS characters). */
function quoteUnits({ model, operationType, units = 1 } = {}) {
    const unitUsd = unitUsdFor(model);
    let usd = 0;
    if (operationType === 'stt') usd = unitUsd * (Math.max(0, Number(units) || 0) / 60); // priced per minute
    else if (operationType === 'tts') usd = unitUsd * (Math.max(0, Number(units) || 0) / 1000); // per 1K chars
    else usd = unitUsd * Math.max(0, Number(units) || 0);
    usd = roundUsd(usd);
    const { irr } = usdToCoins(usd);
    return { model: String(model || ''), provider: PROVIDER.name, operationType, units, usd, irr, exchangeRateIrr: COIN_PRICING.usdToIrr };
}

/** Coins the student pays for a flat operation (config, overridable per model in DB). */
function flatCoinCost(operationType, model) {
    const key = String(model || '').toLowerCase();
    const row = priceCache.rows.get(key);
    if (row && row.flatCoins != null) return row.flatCoins;
    switch (operationType) {
        case 'image_generation': return FLAT_COIN_COSTS.image;
        case 'stt': return FLAT_COIN_COSTS.stt;
        case 'tts': return FLAT_COIN_COSTS.tts;
        case 'pdf_index': return FLAT_COIN_COSTS.pdfIndex;
        default: return 0;
    }
}

function estimateTypicalCoins({ model, maxOutputTokens = 500 } = {}) {
    const typicalIn = 3200; // system prompt + retrieved context + recent turns
    const typicalOut = Math.max(80, Math.min(Number(maxOutputTokens) || 500, 420));
    return quoteUsage({ inputTokens: typicalIn, outputTokens: typicalOut, model });
}

function estimateMaxCoins({ model, maxOutputTokens = 800, allowImage = true } = {}) {
    return quoteUsage({
        inputTokens: 4800,
        outputTokens: Math.max(120, Number(maxOutputTokens) || 800),
        model,
        extraCoins: allowImage ? flatCoinCost('image_generation', MODELS.image) : 0,
    });
}

module.exports = {
    loadPricingTable,
    invalidatePricingCache,
    quoteUsage,
    quoteUnits,
    flatCoinCost,
    usdToCoins,
    estimateTypicalCoins,
    estimateMaxCoins,
    // Legacy aliases
    estimateTypicalEnergy: estimateTypicalCoins,
    estimateMaxEnergy: estimateMaxCoins,
    imageEnergyCost: () => flatCoinCost('image_generation', MODELS.image),
};
