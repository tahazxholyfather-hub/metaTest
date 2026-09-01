'use strict';

const assert = require('assert');
const { calculateCoinCost, nextDailyBalance, quoteMessageCost } = require('../services/coinWallet');
const { quoteUsage } = require('../services/pricing');
const { dailyRefillForPlan, localDateString, planAllowsTeacher, isPaidPlan } = require('../config');
const { titleFromUserMessage, personalizeStarter } = require('../services/conversationService');
const {
    buildTeacherPrompt,
    resolveMaxOutputTokens,
    resolveModel,
    knowledgeBand,
} = require('../services/promptBuilder');

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

test('paid plan gate for pro teachers', () => {
    assert.strictEqual(isPaidPlan('free'), false);
    assert.strictEqual(isPaidPlan('golden'), true);
    assert.strictEqual(planAllowsTeacher('free', { is_free: 1 }), true);
    assert.strictEqual(planAllowsTeacher('free', { is_free: 0 }), false);
    assert.strictEqual(planAllowsTeacher('golden', { is_free: 0 }), true);
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

test('terra is ~10x luna so pro teachers actually cost more', () => {
    const opts = { inputTokens: 2800, outputTokens: 400 };
    const luna = quoteUsage({ ...opts, model: 'gpt-5.6-luna' });
    const terra = quoteUsage({ ...opts, model: 'gpt-5.6-terra' });
    assert.ok(terra.energy > luna.energy * 8);
    assert.ok(terra.usd > luna.usd * 8);
});

test('coin cost uses model list price not fake token rates', () => {
    const energy = calculateCoinCost({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-5.6-luna',
        teacherMultiplier: 1,
    });
    assert.strictEqual(energy, 8);
    const quote = quoteMessageCost({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-5.6-luna',
    });
    assert.strictEqual(quote.energy, energy);
    assert.ok(quote.usd > 0);
    assert.ok(quote.irr > 0);
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

test('title from first user message is truncated', () => {
    const title = titleFromUserMessage('می‌تونی معادله درجه دو رو توضیح بدی؟ ' + 'x'.repeat(100));
    assert.ok(title.length <= 60);
    assert.ok(title.includes('معادله') || title.length > 0);
});

test('starter message personalization', () => {
    const msg = personalizeStarter('سلام {{first_name}}!', { first_name: 'رضا' });
    assert.strictEqual(msg, 'سلام رضا!');
});

test('prompt is English instructions with a hard knowledge ceiling', () => {
    const prompt = buildTeacherPrompt({
        teacher: {
            id: 1,
            display_name: 'نرگس بهرامی',
            subject: 'عمومی',
            is_free: 1,
            knowledge_level: 60,
            personality: 'صبور، گرم',
            teaching_style: 'گام‌به‌گام',
            system_prompt: 'unused',
        },
        user: { first_name: 'رضا', last_name: 'سلطانی' },
        profile: { grade: 'دهم', weaknesses: 'معادله درجه دو' },
        memories: [{ memory_type: 'weakness', content: 'کسرها' }],
        settings: { low_coin_mode: 1, step_by_step: 1, always_examples: 1 },
        conversationSummary: 'مرور مکانیک',
    });
    assert.ok(prompt.includes('ROLELOCK'));
    assert.ok(prompt.includes('spoken Iranian Persian') || prompt.includes('محاوره'));
    assert.ok(prompt.includes('KNOWLEDGE CEILING'));
    assert.ok(prompt.includes('نرگس بهرامی'));
    assert.ok(prompt.includes('رضا'));
    assert.ok(/moles|organic|konkur/i.test(prompt));
    assert.ok(!prompt.includes('از سرتیترهای مارک‌داون'));
});

test('free teacher band is weak_homeroom', () => {
    const band = knowledgeBand({ is_free: 1, knowledge_level: 60, subject: 'عمومی' });
    assert.strictEqual(band.rank, 'weak_homeroom');
});

test('pro chemistry teacher is strong_highschool', () => {
    const band = knowledgeBand({ is_free: 0, knowledge_level: 85, subject: 'شیمی' });
    assert.strictEqual(band.rank, 'strong_highschool');
});

test('low coin mode reduces max tokens and pins luna', () => {
    const normal = resolveMaxOutputTokens({ max_output_tokens: 800 }, { low_coin_mode: 0 });
    const low = resolveMaxOutputTokens({ max_output_tokens: 800 }, { low_coin_mode: 1 });
    assert.ok(low < normal);
    assert.strictEqual(resolveModel({ low_coin_mode: 1 }, { model: 'gpt-5.6-terra' }), 'gpt-5.6-luna');
    assert.strictEqual(resolveModel({ low_coin_mode: 0 }, { model: 'gpt-5.6-terra' }), 'gpt-5.6-terra');
});

test('prompt includes selected book', () => {
    const prompt = buildTeacherPrompt({
        teacher: {
            id: 3,
            display_name: 'آتنا گلکار',
            subject: 'فیزیک',
            knowledge_level: 78,
            is_free: 0,
            system_prompt: 'physics teacher',
        },
        user: { first_name: 'سارا' },
        profile: { grade: 'دهم' },
        memories: [],
        settings: {},
        book: {
            title: 'فیزیک دهم — چاپ ۱۴۰۳',
            subject: 'فیزیک',
            grade: 'دهم',
            content_summary: 'کار و انرژی، دما و گرما',
        },
    });
    assert.ok(prompt.includes('فیزیک دهم'));
    assert.ok(prompt.includes('کار و انرژی'));
    assert.ok(prompt.includes('ROLELOCK'));
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

console.log('AI Teacher unit tests finished.');
