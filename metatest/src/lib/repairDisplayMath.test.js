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
