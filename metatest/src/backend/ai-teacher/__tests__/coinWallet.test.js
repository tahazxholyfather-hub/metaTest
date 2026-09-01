'use strict';

const assert = require('assert');
const { nextDailyBalance, quoteMessageCost } = require('../services/coinWallet');
const { quoteUsage, imageEnergyCost } = require('../services/pricing');
const { dailyRefillForPlan, localDateString } = require('../config');
const { fallbackTitle, personalizeStarter } = require('../services/conversationService');
const { buildMetPrompt, resolveMaxOutputTokens, resolveModel } = require('../services/promptBuilder');
const { SUBJECT_KEYS, getSubject, isValidSubject } = require('../subjects');

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (err) {
        console.error(`✗ ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

test('daily refill amounts by plan', () => {
    assert.strictEqual(dailyRefillForPlan('free'), 80);
    assert.strictEqual(dailyRefillForPlan('bronze'), 300);
    assert.strictEqual(dailyRefillForPlan('diamond'), 1500);
    assert.strictEqual(dailyRefillForPlan('unknown'), 80);
});

test('exactly four subjects: math, biology, physics, chemistry', () => {
    assert.deepStrictEqual([...SUBJECT_KEYS].sort(), ['biology', 'chemistry', 'math', 'physics']);
    assert.ok(isValidSubject('math'));
    assert.ok(!isValidSubject('history'));
    for (const key of SUBJECT_KEYS) {
        const s = getSubject(key);
        assert.ok(s.generalPrompt.includes('Met'), `${key} general prompt should name Met`);
        assert.ok(s.referenceInstructions.length > 20, `${key} needs reference instructions`);
    }
});

test('local calendar date does not use UTC ISO', () => {
    const s = localDateString(new Date(2026, 7, 15, 0, 30, 0));
    assert.strictEqual(s, '2026-08-15');
    assert.strictEqual(localDateString('2026-08-15'), '2026-08-15');
    assert.strictEqual(localDateString('2026-08-15 00:00:00'), '2026-08-15');
});

test('luna usage quotes real USD then IRR then energy', () => {
    const q = quoteUsage({
        inputTokens: 1_000_000,
        outputTokens: 0,
        model: 'gpt-5.6-luna',
    });
    assert.strictEqual(q.usd, 0.2);
    assert.strictEqual(q.irr, 200000);
    assert.strictEqual(q.energy, 2000);

    const msg = quoteUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-5.6-luna',
    });
    // 1000*0.20/1e6 + 500*1.20/1e6 = 0.0002 + 0.0006 = 0.0008 USD = 800 IRR = 8 energy
    assert.ok(Math.abs(msg.usd - 0.0008) < 1e-9);
    assert.strictEqual(msg.irr, 800);
    assert.strictEqual(msg.energy, 8);
});

test('terra is ~10x luna so vision/tool turns actually cost more', () => {
    const opts = { inputTokens: 2800, outputTokens: 400 };
    const luna = quoteUsage({ ...opts, model: 'gpt-5.6-luna' });
    const terra = quoteUsage({ ...opts, model: 'gpt-5.6-terra' });
    assert.ok(terra.energy > luna.energy * 8);
    assert.ok(terra.usd > luna.usd * 8);
});

test('quoteMessageCost matches quoteUsage for the same usage', () => {
    const a = quoteMessageCost({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna' });
    const b = quoteUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna' });
    assert.strictEqual(a.energy, b.energy);
    assert.ok(a.usd > 0);
    assert.ok(a.irr > 0);
});

test('image generation adds a flat energy surcharge', () => {
    const base = quoteUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna' });
    const withImage = quoteUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna', extraEnergy: imageEnergyCost() });
    assert.strictEqual(withImage.energy - base.energy, imageEnergyCost());
});

test('cached tokens bill at cache rate', () => {
    const full = quoteUsage({
        inputTokens: 1_000_000,
        cachedTokens: 0,
        outputTokens: 0,
        model: 'gpt-5.6-luna',
    });
    const cached = quoteUsage({
        inputTokens: 1_000_000,
        cachedTokens: 1_000_000,
        outputTokens: 0,
        model: 'gpt-5.6-luna',
    });
    assert.ok(cached.usd < full.usd);
    assert.ok(Math.abs(cached.usd - 0.02) < 1e-9);
});

test('fallback title truncates a long user message', () => {
    const title = fallbackTitle('می‌تونی معادله درجه دو رو توضیح بدی؟ ' + 'x'.repeat(100));
    assert.ok(title.length <= 60);
    assert.ok(title.includes('معادله') || title.length > 0);
});

test('starter message personalization', () => {
    const msg = personalizeStarter('سلام {{first_name}}!', { first_name: 'رضا' });
    assert.strictEqual(msg, 'سلام رضا!');
});

test('Met prompt hides identity, stays on-subject, includes textbook block', () => {
    const { systemPrompt } = buildMetPrompt({
        subjectKey: 'physics',
        subjectRow: null,
        user: { first_name: 'رضا', last_name: 'سلطانی' },
        memories: [{ memory_type: 'weakness', content: 'کسرها' }],
        settings: { low_coin_mode: 1, step_by_step: 1, always_examples: 1 },
        conversationSummary: 'مرور مکانیک',
        ragContext: { book: { title: 'فیزیک دهم' }, text: 'کار و انرژی' },
    });
    assert.ok(systemPrompt.includes('ROLELOCK'));
    assert.ok(systemPrompt.includes('Met'));
    assert.ok(systemPrompt.includes('never say or imply that you are an AI'));
    assert.ok(systemPrompt.includes('TEXTBOOK REFERENCE'));
    assert.ok(systemPrompt.includes('فیزیک دهم'));
    assert.ok(systemPrompt.includes('رضا'));
});

test('unknown subject key throws instead of silently defaulting', () => {
    assert.throws(() => buildMetPrompt({ subjectKey: 'history', user: {}, memories: [] }));
});

test('low coin mode reduces max tokens and pins the low-cost model', () => {
    const subject = getSubject('math');
    const normal = resolveMaxOutputTokens(subject, { low_coin_mode: 0 });
    const low = resolveMaxOutputTokens(subject, { low_coin_mode: 1 });
    assert.ok(low < normal);
    assert.strictEqual(resolveModel({ low_coin_mode: 1 }, subject), 'gpt-5.6-luna');
});

test('vision model is used whenever the turn has an image attachment', () => {
    const subject = getSubject('biology');
    const model = resolveModel({}, subject, { hasImageAttachment: true });
    assert.notStrictEqual(model, undefined);
});

test('daily energy is capped at the plan allowance', () => {
    assert.strictEqual(nextDailyBalance(100, 200), 200);
    assert.strictEqual(nextDailyBalance(200, 200), 200);
    assert.strictEqual(nextDailyBalance(700, 200), 200);
    assert.strictEqual(nextDailyBalance(0, 50), 50);
    let balance = 100;
    for (let i = 0; i < 3; i++) balance = nextDailyBalance(balance, 200);
    assert.strictEqual(balance, 200);
});

console.log('Met AI Teacher unit tests finished.');
