'use strict';

const assert = require('assert');
const { expandUserMessage, resolveIntent, formatForPrompt, conversationTitle } = require('../services/questionContext');
const { resolveMaxOutputTokens, normalizeSettings } = require('../services/promptBuilder');
const { getSubject } = require('../subjects');

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

test('quiz intent expands into a contextual prompt', () => {
    const intent = resolveIntent('didnt_understand_question');
    assert.ok(intent && intent.label.includes('سوال'));
    const expanded = expandUserMessage(intent.label, 'didnt_understand_question');
    assert.ok(expanded.includes(intent.label));
    assert.ok(expanded.includes('صورت سوال'));
});

test('formatForPrompt includes the live question facts', () => {
    const prompt = formatForPrompt({
        questionId: 101,
        questionText: 'مشتق x^2 چیست؟',
        subject: 'ریاضی',
        subjectKey: 'math',
        topic: 'مشتق',
        choices: [
            { index: 1, text: '2x', isCorrect: true, isSelected: false },
            { index: 2, text: 'x', isCorrect: false, isSelected: true },
        ],
        selectedChoice: { index: 2, text: 'x' },
        isCorrect: false,
        explanation: 'توان را پایین می‌آوریم.',
    });
    assert.ok(prompt.includes('101'));
    assert.ok(prompt.includes('مشتق'));
    assert.ok(prompt.includes('STUDENT PICKED'));
    assert.ok(prompt.includes('incorrect'));
});

test('conversation title prefers topic', () => {
    assert.strictEqual(conversationTitle({ topic: 'مشتق', lesson: 'حسابان' }), 'مشتق');
});

test('quiz conversations get a higher output budget', () => {
    const subject = getSubject('math');
    const settings = normalizeSettings({ verbosity: 'normal', reasoning_level: 'balanced' });
    const normal = resolveMaxOutputTokens(subject, settings, {});
    const quiz = resolveMaxOutputTokens(subject, settings, { quizQuestion: true });
    assert.ok(quiz >= 1100);
    assert.ok(quiz >= normal);
});

if (failures) {
    console.error(`\n${failures} test(s) failed.`);
    process.exit(1);
}
console.log('\nquestionContext tests finished.');
