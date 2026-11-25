'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPaidPlan } = require('./limits');

test('SEC-022 an expired paid plan is not paid', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    assert.equal(isPaidPlan('premium', yesterday), false);
    assert.equal(isPaidPlan('premium', new Date(Date.now() + 24 * 60 * 60 * 1000)), true);
    assert.equal(isPaidPlan('free', null), false);
});
