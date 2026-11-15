'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    editorBlocks,
    emptyDocument,
    resolveSurface,
    sanitizeDocument,
    toCssVars,
    forceDisplayMode,
} = require('./questionDisplay');

test('an empty document keeps each surface on its current sizes', () => {
    const practice = resolveSurface(emptyDocument(), 'practice');
    const exam = resolveSurface(emptyDocument(), 'exam');
    const review = resolveSurface(emptyDocument(), 'examReview');
    assert.equal(practice.stem.fontSizeDesktop, 19);
    assert.equal(practice.explanation.fontSizeDesktop, 17);
    assert.equal(exam.stem.fontSizeDesktop, 20);
    assert.equal(exam.stem.weight, 700);
    assert.equal(exam.image.maxWidthDesktop, 200);
    assert.equal(review.explanation.fontSizeDesktop, 14);
    assert.equal(review.stem.fontSizeMobile, 14);
});

test('base applies to every surface and a surface override wins', () => {
    const document = sanitizeDocument({
        base: { stem: { fontSizeDesktop: 22 } },
        surfaces: { exam: { stem: { fontSizeDesktop: 24, fontSizeMobile: 18 } } },
    });
    assert.equal(resolveSurface(document, 'practice').stem.fontSizeDesktop, 22);
    assert.equal(resolveSurface(document, 'practice').stem.fontSizeMobile, 16);
    assert.equal(resolveSurface(document, 'exam').stem.fontSizeDesktop, 24);
    assert.equal(resolveSurface(document, 'examReview').stem.fontSizeDesktop, 22);
    assert.equal(resolveSurface(document, 'exam').options.fontSizeDesktop, 16);
});

test('sanitize drops unknown keys, clamps ranges, and strips exam explanation', () => {
    const document = sanitizeDocument({
        version: 9,
        base: { stem: { fontSizeDesktop: 99, weight: 400, lineHeight: 'big' }, nope: { fontSizeDesktop: 20 } },
        surfaces: {
            exam: {
                explanation: { fontSizeDesktop: 20 },
                stem: { fontSizeMobile: 10 },
                layout: { questionGap: 80 },
            },
            practice: { layout: { questionGap: 80, optionColumns: 3 } },
        },
    });
    assert.equal(document.version, 1);
    assert.equal(document.base.stem.fontSizeDesktop, 28);
    assert.equal(document.base.stem.weight, undefined);
    assert.equal(document.base.stem.lineHeight, undefined);
    assert.equal(document.base.nope, undefined);
    assert.equal(document.surfaces.exam.explanation, undefined);
    assert.equal(document.surfaces.exam.stem.fontSizeMobile, 14);
    assert.equal(document.surfaces.exam.layout.questionGap, 80);
    assert.equal(document.surfaces.practice.layout, undefined);
});

test('the exam editor has no explanation block and keeps the gap between questions', () => {
    const blocks = editorBlocks('exam');
    assert.equal(blocks.some((block) => block.block === 'explanation'), false);
    const layout = blocks.find((block) => block.block === 'layout');
    assert.equal(layout.fields.some((field) => field.key === 'questionGap'), true);
    assert.equal(editorBlocks('practice').find((block) => block.block === 'layout').fields.some((field) => field.key === 'questionGap'), false);
});

test('css variables follow the resolved surface and a preview can force mobile', () => {
    const vars = toCssVars(resolveSurface({
        base: { stem: { fontSizeDesktop: 22, fontSizeMobile: 15 } },
    }, 'practice'));
    assert.equal(vars['--q-stem-size'], '15px');
    assert.equal(vars['--q-stem-size-md'], '22px');
    assert.equal(vars['--q-option-cols'], '2');
    const mobile = forceDisplayMode(vars, 'mobile');
    assert.equal(mobile['--q-stem-size-active'], '15px');
    assert.equal(mobile['--q-option-cols-active'], '1');
    const desktop = forceDisplayMode(vars, 'desktop');
    assert.equal(desktop['--q-stem-size-active'], '22px');
    assert.equal(desktop['--q-option-cols-active'], '2');
});
