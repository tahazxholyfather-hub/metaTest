import test from 'node:test';
import assert from 'node:assert/strict';
import { repairDisplayMath } from './repairDisplayMath.js';

test('word text macros become the formula letters', () => {
    assert.equal(repairDisplayMath('$\\text{H}_{2}\\text{O}$'), '$H_{2}O$');
    assert.equal(repairDisplayMath('فرمول \\text{C}-\\text{H}'), 'فرمول C-H');
});

test('a bare ce command is removed so MathJax does not draw the yellow error', () => {
    assert.equal(repairDisplayMath('جرم $\\ce$ مولی'), 'جرم  مولی');
    assert.equal(repairDisplayMath('$\\ce{H2O}$'), '$\\ce{H2O}$');
    assert.equal(repairDisplayMath('$\\ce{\\text{H}_{2}\\text{O}}$'), '$\\ce{H_{2}O}$');
});

test('display math stays intact', () => {
    assert.equal(repairDisplayMath('$$H_2O$$'), '$$H_2O$$');
});

test('a command split in the middle is joined before MathJax paints it red', () => {
    assert.equal(
        repairDisplayMath('$(O = 16g\\cdo tmol^{-1})$'),
        '$(O = 16g\\cdot mol^{-1})$',
    );
    assert.equal(
        repairDisplayMath('$(O = 16g\\cdo\u200ct mol^{-1})$'),
        '$(O = 16g\\cdot mol^{-1})$',
    );
    assert.equal(repairDisplayMath('$\\cdo\u202at$'), '$\\cdot$');
    assert.equal(repairDisplayMath('$\\sin\u200cx$'), '$\\sin x$');
    assert.equal(repairDisplayMath('$\\c d o t$'), '$\\cdot$');
    assert.equal(repairDisplayMath('$\\cdo ts$'), '$\\cdots$');
    assert.equal(repairDisplayMath('$\\fra c{1}{2}$'), '$\\frac{1}{2}$');
    assert.equal(repairDisplayMath('$\\sqr t{2}$'), '$\\sqrt{2}$');
    assert.equal(repairDisplayMath('$\\right arrow$'), '$\\rightarrow$');
    assert.equal(repairDisplayMath('$\\in fty$'), '$\\infty$');
    assert.equal(repairDisplayMath('$\\time s$'), '$\\times$');
    assert.equal(repairDisplayMath('$\\mathr m{H}$'), '$H$');
    assert.equal(repairDisplayMath('$H_\u200c2$'), '$H_2$');
    assert.equal(repairDisplayMath('$H_\u2060{2}$'), '$H_{2}$');
    assert.equal(repairDisplayMath('$\\ce\u200c{H2O}$'), '$\\ce{H2O}$');
    assert.equal(repairDisplayMath('$\\celsius$'), '$\\celsius$');
    assert.equal(repairDisplayMath('$x \\in t$'), '$x \\in t$');
    assert.equal(repairDisplayMath('$\\sin x$'), '$\\sin x$');
    assert.equal(repairDisplayMath('$\\to p$'), '$\\to p$');
    assert.equal(repairDisplayMath('$\\alpha \\beta$'), '$\\alpha \\beta$');
});
