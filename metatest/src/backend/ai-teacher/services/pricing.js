'use strict';

const { COIN_PRICING, MODELS, modelPrices } = require('../config');

function roundUsd(n) {
    return Math.round((Number(n) || 0) * 1e10) / 1e10;
}

/**
 * Exact provider USD for this usage, then IRR + integer energy (always round energy up).
 * Energy is what the student spends. USD/IRR are stored for admin later.
 */
function quoteUsage({
    inputTokens = 0,
    outputTokens = 0,
    cachedTokens = 0,
    model = MODELS.default,
    teacherMultiplier = 1,
} = {}) {
    const rates = modelPrices(model);
    const inTok = Math.max(0, Number(inputTokens) || 0);
    const outTok = Math.max(0, Number(outputTokens) || 0);
    const cacheTok = Math.max(0, Number(cachedTokens) || 0);
    const uncachedIn = Math.max(0, inTok - cacheTok);

    const usd = roundUsd(
        (uncachedIn / 1e6) * rates.input
        + (cacheTok / 1e6) * (rates.cache || 0)
        + (outTok / 1e6) * rates.output
    );

    const multiplier = Math.max(0.01, Number(teacherMultiplier) || 1);
    const billedUsd = roundUsd(usd * multiplier);
    const exchangeRateIrr = COIN_PRICING.usdToIrr;
    const irr = Math.max(0, Math.round(billedUsd * exchangeRateIrr));
    const energy = Math.max(COIN_PRICING.minCharge, Math.ceil(irr / COIN_PRICING.irrPerEnergy) || COIN_PRICING.minCharge);

    return {
        model: String(model || MODELS.default),
        rates,
        inputTokens: inTok,
        outputTokens: outTok,
        cachedTokens: cacheTok,
        usd: billedUsd,
        apiUsd: usd,
        irr,
        energy,
        exchangeRateIrr,
        irrPerEnergy: COIN_PRICING.irrPerEnergy,
        teacherMultiplier: multiplier,
    };
}

function estimateTypicalEnergy({ model, maxOutputTokens = 500, teacherMultiplier = 1 } = {}) {
    const typicalIn = 2800;
    const typicalOut = Math.max(80, Math.min(Number(maxOutputTokens) || 500, 420));
    return quoteUsage({
        inputTokens: typicalIn,
        outputTokens: typicalOut,
        model,
        teacherMultiplier,
    });
}

function estimateMaxEnergy({ model, maxOutputTokens = 800, teacherMultiplier = 1 } = {}) {
    return quoteUsage({
        inputTokens: 4200,
        outputTokens: Math.max(120, Number(maxOutputTokens) || 800),
        model,
        teacherMultiplier,
    });
}

module.exports = {
    quoteUsage,
    estimateTypicalEnergy,
    estimateMaxEnergy,
};
