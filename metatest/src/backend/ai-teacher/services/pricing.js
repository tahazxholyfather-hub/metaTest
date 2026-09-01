'use strict';

const { COIN_PRICING, MODELS, modelPrices, IMAGE_ENERGY_COST } = require('../config');

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
    extraEnergy = 0,
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

    const exchangeRateIrr = COIN_PRICING.usdToIrr;
    const irr = Math.max(0, Math.round(usd * exchangeRateIrr));
    const baseEnergy = Math.max(COIN_PRICING.minCharge, Math.ceil(irr / COIN_PRICING.irrPerEnergy) || COIN_PRICING.minCharge);
    const energy = baseEnergy + Math.max(0, Number(extraEnergy) || 0);

    return {
        model: String(model || MODELS.default),
        rates,
        inputTokens: inTok,
        outputTokens: outTok,
        cachedTokens: cacheTok,
        usd,
        irr,
        energy,
        exchangeRateIrr,
        irrPerEnergy: COIN_PRICING.irrPerEnergy,
    };
}

function estimateTypicalEnergy({ model, maxOutputTokens = 500 } = {}) {
    const typicalIn = 3200; // includes RAG excerpt + memory + recent turns
    const typicalOut = Math.max(80, Math.min(Number(maxOutputTokens) || 500, 420));
    return quoteUsage({ inputTokens: typicalIn, outputTokens: typicalOut, model });
}

function estimateMaxEnergy({ model, maxOutputTokens = 800 } = {}) {
    return quoteUsage({
        inputTokens: 4800,
        outputTokens: Math.max(120, Number(maxOutputTokens) || 800),
        model,
        extraEnergy: IMAGE_ENERGY_COST, // reserve enough headroom in case Met generates an image
    });
}

function imageEnergyCost() {
    return IMAGE_ENERGY_COST;
}

module.exports = {
    quoteUsage,
    estimateTypicalEnergy,
    estimateMaxEnergy,
    imageEnergyCost,
};
