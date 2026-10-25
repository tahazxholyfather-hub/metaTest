'use strict';

const assert = require('assert');
const { buildMetPrompt, normalizeSettings } = require('../services/promptBuilder');
const { getSubject } = require('../subjects');
const {
    assessReply,
    collapseRepeatedParagraphs,
    continuationInstruction,
    hasUnclosedMath,
    isContinuableFinish,
    normalizeAssistantText,
    stitchContinuation,
} = require('../services/replyQuality');

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (err) {
        failures += 1;
        console.error(`✗ ${name}`);
        console.error(err);
    }
}

const SOAP_CUT = 'اگر به‌جای سدیم هیدروکسید از پت';
const SOAP_NEXT = 'اسید پتاسیم هیدروکسید به‌کار ببرند، صابون‌های پتاسیمی ساخته می‌شوند.';

test('a length finish is incomplete and a normal stop is complete', () => {
    assert.strictEqual(assessReply('صابون چربی را جدا می‌کند.', 'stop').incomplete, false);
    assert.strictEqual(assessReply('مانند صابون', 'length').incomplete, true);
    assert.strictEqual(assessReply('مانند صابون', 'length').reason, 'length');
    assert.strictEqual(assessReply('متن نصفه‌کاره', 'timeout').reason, 'timeout');
    assert.strictEqual(assessReply('این پاسخ تمام شد', 'stop', { userStopped: true }).incomplete, true);
    assert.strictEqual(assessReply('این پاسخ تمام شد.', 'stop', { userStopped: true }).incomplete, false);
});

test('unclosed math is incomplete even when the model says stop', () => {
    assert.strictEqual(hasUnclosedMath('فرمول $$H_2O باز ماند'), true);
    assert.strictEqual(assessReply('فرمول باز $H_2O', 'stop').incomplete, true);
    assert.strictEqual(assessReply('آب $H_2O$ است.', 'stop').incomplete, false);
    assert.strictEqual(isContinuableFinish('length', 'مانند صابون', 'complete'), true);
    assert.strictEqual(isContinuableFinish('stop', 'تمام شد.', 'complete'), false);
    assert.strictEqual(isContinuableFinish('stop', 'تمام شد.', 'error'), false);
});

test('hitting the token budget without a finish reason is truncated', () => {
    const cut = assessReply('تفاوت مهم این است که', null, { outputTokens: 800, maxTokens: 800 });
    assert.strictEqual(cut.incomplete, true);
    assert.strictEqual(cut.reason, 'length');
    assert.strictEqual(assessReply('تفاوت مهم این است که', 'stop', { outputTokens: 1600, maxTokens: 800 }).incomplete, false);
});

test('the soap cut completes the word instead of gluing پتاسید', () => {
    const joined = stitchContinuation(SOAP_CUT, SOAP_NEXT);
    assert.ok(joined.endsWith('ساخته می‌شوند.'));
    assert.ok(joined.includes('از پتاسیم هیدروکسید'));
    assert.ok(!joined.includes('پتاسید'));
    assert.ok(!joined.includes('اسید پتاسیم'));
});

test('a real mid-word token join stays intact', () => {
    assert.strictEqual(stitchContinuation('هیدروکس', 'ید به‌کار'), 'هیدروکسید به‌کار');
    assert.strictEqual(stitchContinuation('از', 'آب سرد'), 'از آب سرد');
    assert.strictEqual(stitchContinuation('پتاسیم', 'هیدروکسید است.'), 'پتاسیم هیدروکسید است.');
});

test('a repeated ending is not appended twice', () => {
    const prior = 'صابون‌های سدیمی معمولاً سفت‌تر هستند و برای قالب مناسب‌اند.';
    const next = `${prior} صابون‌های پتاسیمی نرم‌ترند.`;
    const joined = stitchContinuation(prior, next);
    assert.strictEqual(joined, `${prior} صابون‌های پتاسیمی نرم‌ترند.`);
    assert.strictEqual(joined.split('سفت‌تر').length, 2);
});

test('a restarted answer keeps only the new tail', () => {
    const prior = 'صابون، نمک یک اسید چرب است. اگر به‌جای سدیم هیدروکسید از پت';
    const restart = `${prior.slice(0, -2)}پتاسیم هیدروکسید استفاده کنند، صابون نرم می‌شود.`;
    const joined = stitchContinuation(prior, restart);
    assert.ok(joined.includes('صابون نرم می‌شود.'));
    assert.strictEqual(joined.split('اسید چرب').length, 2);
    assert.ok(!joined.includes('پتاسید'));
});

test('an identical paragraph is dropped once', () => {
    const text = 'میسل قطره‌ی چربی را در آب پخش می‌کند.\n\nمیسل قطره‌ی چربی را در آب پخش می‌کند.\n\nبعد آبکشی می‌کنیم.';
    const collapsed = collapseRepeatedParagraphs(text);
    assert.strictEqual(collapsed.split('میسل').length, 2);
    assert.ok(collapsed.includes('بعد آبکشی می‌کنیم.'));
});

test('continuation instructions stay in Persian and forbid repetition', () => {
    const text = continuationInstruction('از پت');
    assert.ok(text.includes('تکرار نکن'));
    assert.ok(text.includes('فارسی'));
    assert.ok(text.includes('از پت'));
    assert.ok(!/[A-Za-z]{4,}/.test(text));
});

test('Persian inside a chemical equation leaves math and keeps word order', () => {
    const raw = '$$\\mathrm{تری\\!-\\!گلیسرید + 3NaOH \\longrightarrow گلیسرول + 3RCOONa}$$';
    const normalized = normalizeAssistantText(raw);
    assert.ok(normalized.includes('\u2066'));
    assert.ok(normalized.includes('\u2067تری-گلیسرید\u2069'));
    assert.ok(normalized.includes('\u2067گلیسرول\u2069'));
    assert.ok(normalized.includes('3NaOH \\longrightarrow'));
    assert.ok(!normalized.includes('\\mathrm{تری'));
    const math = [...normalized.matchAll(/\$([^$]+)\$/g)].map((match) => match[1]);
    assert.ok(math.length >= 1);
    for (const piece of math) assert.ok(!/[\u0600-\u06FF]/.test(piece), piece);
    const triglyceride = normalized.indexOf('تری-گلیسرید');
    const glycerol = normalized.indexOf('گلیسرول');
    const formula = normalized.indexOf('3NaOH');
    assert.ok(triglyceride < formula && formula < glycerol);
});

test('pure formulas and code fences stay untouched', () => {
    const pure = '$$\\mathrm{C_{17}H_{35}COONa}$$ و $H_2O$';
    assert.strictEqual(normalizeAssistantText(pure), pure);
    const fenced = '```\n$$\\mathrm{تری}$$\n```\nمتن';
    assert.strictEqual(normalizeAssistantText(fenced), fenced);
    const brackets = '\\[H_2O\\] و \\(Na+\\)';
    assert.strictEqual(normalizeAssistantText(brackets), '$$H_2O$$ و $Na+$');
});

test('the system prompt demands simple Persian and MathJax-safe formulas', () => {
    const { systemPrompt } = buildMetPrompt({
        subjectKey: 'chemistry',
        subjectRow: null,
        user: { first_name: 'سعید' },
        memories: [],
        settings: normalizeSettings({}),
        conversationSummary: null,
        ragContext: null,
        knowledgeContext: null,
        referenceContext: null,
    });
    assert.ok(systemPrompt.includes('هرگز فارسی را داخل'));
    assert.ok(systemPrompt.includes('پنج‌ساله'));
    assert.ok(systemPrompt.includes('نیم‌فاصله'));
    assert.ok(systemPrompt.includes('$...$'));
    assert.ok(!systemPrompt.includes('may you answer in English'));
    assert.ok(getSubject('chemistry').referenceInstructions.includes('LaTeX') || systemPrompt.includes('\\ce'));
});

if (failures) {
    console.error(`\n${failures} test(s) failed.`);
    process.exit(1);
}
console.log('\nreplyQuality tests finished.');
