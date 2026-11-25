import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeQuestionHtml, decodeHtmlEntities } from './sanitizeQuestionHtml.ts';

test('SEC-013 strips script and event handlers and keeps math tags', () => {
    const dirty = '<p>2<sup>3</sup></p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>';
    const clean = sanitizeQuestionHtml(dirty);
    assert.equal(clean.includes('<script'), false);
    assert.equal(clean.includes('onerror'), false);
    assert.equal(clean.includes('javascript:'), false);
    assert.equal(clean.includes('<sup>'), true);
});

test('SEC-013 entity decode does not need innerHTML', () => {
    assert.equal(decodeHtmlEntities('a&nbsp;&lt;b&gt;'), 'a <b>');
});
