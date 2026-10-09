'use strict';

/**
 * Met AI subsystem unit tests — no MySQL required.
 * Run: node src/backend/ai-teacher/__tests__/coinWallet.test.js
 */

process.env.AI_API_KEY = process.env.AI_API_KEY || 'test-key';

const assert = require('assert');
const coinWallet = require('../services/coinWallet');
const { quoteUsage, quoteUnits, flatCoinCost, estimateTypicalCoins } = require('../services/pricing');
const { dailyCoinsForPlan, localDateString, featureStatus, MODELS } = require('../config');
const { fallbackTitle } = require('../services/conversationService');
const { buildMetPrompt, resolveMaxOutputTokens, resolveModel, resolveTemperature, normalizeSettings, toProviderMessages } = require('../services/promptBuilder');
const { SUBJECT_KEYS, CORE_SUBJECT_KEYS, getSubject, isValidSubject, subjectKeyFromText } = require('../subjects');
const { sanitizeForSpeech } = require('../controller');

let failures = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log(`✓ ${name}`);
    } catch (err) {
        failures += 1;
        console.error(`✗ ${name}`);
        console.error(err);
    }
}

/** Minimal in-memory stand-in for the two wallet tables (single user). */
function fakeDb(initial = { daily: 0, purchased: 0, grantedOn: null }) {
    const state = { user_id: 1, balance: 0, daily_balance: initial.daily, purchased_balance: initial.purchased, lifetime_earned: 0, lifetime_spent: 0, daily_granted_on: initial.grantedOn };
    const ledger = [];
    const conn = {
        async query(sql, params = []) {
            const s = sql.replace(/\s+/g, ' ').trim();
            if (s.startsWith('INSERT IGNORE INTO tam24_ai_wallets')) return [{ affectedRows: 0 }];
            if (s.startsWith('SELECT user_id, balance, daily_balance')) return [[{ ...state }]];
            if (s.startsWith('UPDATE tam24_ai_wallets')) {
                const [daily, purchased] = params;
                state.daily_balance = daily; state.purchased_balance = purchased; state.balance = daily + purchased;
                if (/daily_granted_on = \?/.test(s)) state.daily_granted_on = params[params.length - 2];
                return [{ affectedRows: 1 }];
            }
            if (s.startsWith('INSERT INTO tam24_ai_coin_transactions')) {
                const row = { type: params[1], amount: params[2], daily_delta: params[3], purchased_delta: params[4], reference_id: params[10] };
                if (ledger.some((l) => l.type === row.type && l.reference_id === row.reference_id && ['daily_grant', 'daily_expire', 'purchase'].includes(row.type))) {
                    throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
                }
                ledger.push(row);
                return [{ insertId: ledger.length }];
            }
            throw new Error(`unexpected SQL in fake db: ${s.slice(0, 80)}`);
        },
        async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    };
    return { conn, state, ledger, db: { ...conn, getConnection: async () => conn } };
}

(async () => {
    await test('daily coin quota by plan (free is a small daily budget)', () => {
        assert.strictEqual(dailyCoinsForPlan('free'), 24);
        assert.strictEqual(dailyCoinsForPlan('bronze'), 300);
        assert.strictEqual(dailyCoinsForPlan('diamond'), 1500);
        assert.strictEqual(dailyCoinsForPlan('3'), 300, 'numeric paid plan ids use the bronze floor');
        assert.strictEqual(dailyCoinsForPlan('unknown'), 300);
    });

    await test('four curriculum subjects + general fallback', () => {
        assert.deepStrictEqual([...CORE_SUBJECT_KEYS].sort(), ['biology', 'chemistry', 'math', 'physics']);
        assert.ok(SUBJECT_KEYS.includes('general'));
        assert.ok(isValidSubject('general') && isValidSubject('math') && !isValidSubject('history'));
        for (const key of SUBJECT_KEYS) {
            const s = getSubject(key);
            assert.ok(s.generalPrompt.includes('Met'), `${key} general prompt should name Met`);
            assert.ok(s.referenceInstructions.length > 20, `${key} needs reference instructions`);
        }
        assert.strictEqual(subjectKeyFromText('ریاضی'), 'math');
        assert.strictEqual(subjectKeyFromText('Physics'), 'physics');
        assert.strictEqual(subjectKeyFromText('تاریخ'), null);
    });

    await test('feature matrix is derived, never raw env', () => {
        const f = featureStatus();
        assert.strictEqual(typeof f.aiAvailable, 'boolean');
        for (const k of ['vision', 'imageGeneration', 'stt', 'tts', 'pdfReferences', 'memory', 'knowledgeBase', 'tools', 'suggestions']) {
            assert.strictEqual(typeof f[k], 'boolean', k);
        }
    });

    await test('local calendar date does not use UTC ISO', () => {
        assert.strictEqual(localDateString(new Date(2026, 7, 15, 0, 30, 0)), '2026-08-15');
        assert.strictEqual(localDateString('2026-08-15'), '2026-08-15');
        assert.strictEqual(localDateString('2026-08-15 00:00:00'), '2026-08-15');
    });

    await test('luna usage quotes real USD → IRR → coins', () => {
        const q = quoteUsage({ inputTokens: 1_000_000, outputTokens: 0, model: 'gpt-5.6-luna' });
        assert.strictEqual(q.usd, 0.2);
        assert.strictEqual(q.irr, 200000);
        assert.strictEqual(q.coins, 2000);
        assert.strictEqual(q.energy, q.coins);
        const msg = quoteUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna' });
        assert.ok(Math.abs(msg.usd - 0.0008) < 1e-9);
        assert.strictEqual(msg.coins, 8);
    });

    await test('terra costs ~10x luna; cached tokens bill at cache rate', () => {
        const opts = { inputTokens: 2800, outputTokens: 400 };
        assert.ok(quoteUsage({ ...opts, model: 'gpt-5.6-terra' }).coins > quoteUsage({ ...opts, model: 'gpt-5.6-luna' }).coins * 8);
        const full = quoteUsage({ inputTokens: 1_000_000, model: 'gpt-5.6-luna' });
        const cached = quoteUsage({ inputTokens: 1_000_000, cachedTokens: 1_000_000, model: 'gpt-5.6-luna' });
        assert.ok(cached.usd < full.usd && Math.abs(cached.usd - 0.02) < 1e-9);
    });

    await test('flat surcharges and unit pricing', () => {
        const base = quoteUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna' });
        const img = flatCoinCost('image_generation', MODELS.image);
        assert.ok(img > 0);
        assert.strictEqual(quoteUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-5.6-luna', extraCoins: img }).coins - base.coins, img);
        const stt = quoteUnits({ model: 'whisper-1', operationType: 'stt', units: 60 });
        assert.ok(Math.abs(stt.usd - 0.006) < 1e-9);
        assert.ok(estimateTypicalCoins({ model: 'gpt-5.6-luna', maxOutputTokens: 500 }).coins >= 1);
    });

    await test('wallet: daily grant, no rollover, purchased untouched', async () => {
        const { db, state, ledger } = fakeDb({ daily: 30, purchased: 50, grantedOn: '2000-01-01' });
        const r = await coinWallet.applyDailyGrant(db, 1, 'free');
        assert.strictEqual(r.granted, true);
        assert.strictEqual(r.expired, 30, 'yesterday\'s leftover daily coins expire');
        assert.strictEqual(state.daily_balance, 24);
        assert.strictEqual(state.purchased_balance, 50);
        assert.ok(ledger.some((l) => l.type === 'daily_expire' && l.daily_delta === -30));
        assert.ok(ledger.some((l) => l.type === 'daily_grant' && l.daily_delta === 24));
        const again = await coinWallet.applyDailyGrant(db, 1, 'free');
        assert.strictEqual(again.granted, false, 'grant is idempotent within a day');
        assert.strictEqual(state.daily_balance, 24);
    });

    await test('wallet: reserve daily-first, settle, release unused; purchased spent only when daily is out', async () => {
        const { conn, state, ledger } = fakeDb({ daily: 10, purchased: 100, grantedOn: localDateString(new Date()) });
        const res = await coinWallet.reserveCoins(conn, 1, 25, 'ref-1', { operationType: 'chat' });
        assert.strictEqual(res.reserved, 25);
        assert.strictEqual(res.reservedDaily, 10);
        assert.strictEqual(res.reservedPurchased, 15);
        assert.strictEqual(state.daily_balance, 0);
        assert.strictEqual(state.purchased_balance, 85);

        const charge = await coinWallet.finalizeCharge(conn, 1, { reserved: 25, reservedDaily: 10, reservedPurchased: 15, finalCost: 12, referenceId: 'ref-1' });
        assert.strictEqual(charge.charged, 12);
        assert.strictEqual(charge.chargedDaily, 10);
        assert.strictEqual(charge.chargedPurchased, 2);
        assert.strictEqual(charge.refunded, 13);
        assert.strictEqual(state.daily_balance, 0);
        assert.strictEqual(state.purchased_balance, 98);
        assert.ok(ledger.some((l) => l.type === 'reservation_release'));
        assert.ok(ledger.some((l) => l.type === 'ai_usage' && l.daily_delta === -10 && l.purchased_delta === -2));
    });

    await test('wallet: refund restores the exact buckets; insufficient balance throws', async () => {
        const { db, conn, state } = fakeDb({ daily: 5, purchased: 0, grantedOn: localDateString(new Date()) });
        const res = await coinWallet.reserveCoins(conn, 1, 20, 'ref-2');
        assert.strictEqual(res.reserved, 5, 'reservation is capped at the balance');
        const refund = await coinWallet.refundReservation(db, 1, res, 'ref-2');
        assert.strictEqual(refund.refunded, 5);
        assert.strictEqual(state.daily_balance, 5);
        state.daily_balance = 0;
        await assert.rejects(() => coinWallet.reserveCoins(conn, 1, 10, 'ref-3'), (e) => e.code === 'INSUFFICIENT_COINS');
        await assert.rejects(() => coinWallet.chargeFlat(db, 1, 3, { reason: 't' }), (e) => e.code === 'INSUFFICIENT_COINS');
    });

    await test('wallet: purchases credit the purchased bucket and are idempotent per reference', async () => {
        const { db, state } = fakeDb({ daily: 0, purchased: 0, grantedOn: null });
        const a = await coinWallet.creditPurchased(db, 1, 500, { referenceId: 'pay-1' });
        const b = await coinWallet.creditPurchased(db, 1, 500, { referenceId: 'pay-1' });
        assert.strictEqual(a.credited, 500);
        assert.strictEqual(b.duplicate, true);
        assert.strictEqual(state.purchased_balance, 500);
        assert.strictEqual(state.daily_balance, 0);
    });

    await test('fallback title truncates a long user message', () => {
        const title = fallbackTitle('می‌تونی معادله درجه دو رو توضیح بدی؟ ' + 'x'.repeat(100));
        assert.ok(title.length <= 60 && title.includes('معادله'));
    });

    await test('settings normalise into the public shape and drive model/temperature', () => {
        const s = normalizeSettings({ tone: 'formal', reasoning_level: 'deep', verbosity: 'short', creativity: 20, low_coin_mode: 0 });
        assert.strictEqual(s.tone, 'formal');
        assert.strictEqual(s.reasoningLevel, 'deep');
        assert.strictEqual(resolveModel(s, getSubject('math')), MODELS.textDeep);
        assert.strictEqual(resolveModel(normalizeSettings({ low_coin_mode: 1 }), getSubject('math')), MODELS.textFast);
        assert.strictEqual(resolveModel(normalizeSettings({}), getSubject('biology'), { hasImageAttachment: true }), MODELS.vision);
        assert.ok(resolveTemperature(s) < resolveTemperature(normalizeSettings({ creativity: 90, tone: 'playful' })));
        const subject = getSubject('math');
        assert.ok(resolveMaxOutputTokens(subject, normalizeSettings({ low_coin_mode: 1 })) < resolveMaxOutputTokens(subject, normalizeSettings({})));
        assert.ok(resolveMaxOutputTokens(subject, normalizeSettings({ verbosity: 'detailed' })) > resolveMaxOutputTokens(subject, normalizeSettings({})));
    });

    await test('Met prompt: identity hidden, scoped to subject, Persian, includes knowledge/textbook/references', () => {
        const { systemPrompt } = buildMetPrompt({
            subjectKey: 'physics', subjectRow: null,
            user: { first_name: 'رضا', last_name: 'سلطانی' },
            memories: [{ memory_type: 'weakness', content: 'کسرها', subject_key: 'math' }],
            settings: normalizeSettings({ low_coin_mode: 1, step_by_step: 1, always_examples: 1 }),
            conversationSummary: 'مرور مکانیک',
            ragContext: { book: { title: 'فیزیک دهم' }, text: 'کار و انرژی' },
            knowledgeContext: { text: 'نکته‌ی معلم: قانون دوم نیوتن', items: [{ id: 1 }] },
            referenceContext: { text: 'جزوه‌ی دانش‌آموز صفحه ۳', references: [{ id: 9 }] },
        });
        for (const needle of ['Met', 'TEXTBOOK REFERENCE', 'فیزیک دهم', 'CURATED KNOWLEDGE', 'STUDENT\'S OWN REFERENCES', 'رضا', 'SCOPE: this room is فیزیک', 'Always respond in Persian', 'کسرها']) {
            assert.ok(systemPrompt.includes(needle), `prompt should include: ${needle}`);
        }
        const general = buildMetPrompt({ subjectKey: 'general', user: {}, memories: [], settings: normalizeSettings({}) }).systemPrompt;
        assert.ok(general.includes('general study chat'));
        assert.throws(() => buildMetPrompt({ subjectKey: 'history', user: {}, memories: [] }));
    });

    await test('memory block respects the student\'s memory toggle', () => {
        const off = buildMetPrompt({
            subjectKey: 'math', user: {}, memories: [{ memory_type: 'goal', content: 'کنکور ۱۴۰۶' }],
            settings: normalizeSettings({ memory_enabled: 0 }),
        }).systemPrompt;
        assert.ok(!off.includes('کنکور ۱۴۰۶'));
    });

    await test('provider messages: vision parts only for the current turn, older images summarised', () => {
        const msgs = toProviderMessages({
            systemPrompt: 'sys',
            recentMessages: [{ role: 'user', content: 'این چیه؟', attachments: [{ type: 'image', url: '/x.webp' }] }, { role: 'assistant', content: 'یک نمودار.' }],
            currentUserMessage: 'حلش کن',
            currentAttachments: [{ type: 'image', url: '/uploads/ai/images/a.webp', dataUrl: 'data:image/webp;base64,AAAA' }],
        });
        assert.strictEqual(msgs[0].role, 'system');
        assert.ok(msgs[1].content.includes('تصویر'));
        const last = msgs[msgs.length - 1];
        if (featureStatus().vision) {
            assert.ok(Array.isArray(last.content));
            assert.strictEqual(last.content[1].image_url.url, 'data:image/webp;base64,AAAA');
        } else {
            assert.strictEqual(typeof last.content, 'string');
        }
    });

    await test('TTS sanitiser strips formulas/markdown', () => {
        const out = sanitizeForSpeech('**نیرو** برابر است با $F = ma$\n- گام اول\n## عنوان');
        assert.ok(!out.includes('$') && !out.includes('**') && !out.includes('##') && out.includes('(فرمول)'));
    });

    if (failures) {
        console.error(`\n${failures} test(s) failed.`);
        process.exit(1);
    }
    console.log('\nMet AI subsystem unit tests finished.');
})();
