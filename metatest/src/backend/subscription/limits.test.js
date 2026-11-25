'use strict';

const assert = require('assert');
const { isPaidPlan, subjectBucket, coinPackageById, FREE_LIMITS, COIN_PACKAGES } = require('./limits');

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

test('free and expired plans are not paid', () => {
    assert.strictEqual(isPaidPlan('free', null), false);
    assert.strictEqual(isPaidPlan('', null), false);
    assert.strictEqual(isPaidPlan(null, null), false);
    assert.strictEqual(isPaidPlan('bronze', '2000-01-01T00:00:00.000Z'), false);
});

test('named and numeric plans are paid', () => {
    assert.strictEqual(isPaidPlan('diamond', null), true);
    assert.strictEqual(isPaidPlan('premium', null), true);
    assert.strictEqual(isPaidPlan('3', null), true);
    assert.strictEqual(isPaidPlan('bronze', '2099-01-01T00:00:00.000Z'), true);
});

test('subject buckets stay per curriculum subject', () => {
    assert.strictEqual(subjectBucket('math', 9), 'math');
    assert.strictEqual(subjectBucket('chemistry', 1), 'chemistry');
    assert.strictEqual(subjectBucket('general', 12), 'subject:12');
    assert.strictEqual(subjectBucket('', null), 'general');
});

test('coin packs are addressable and free caps stay small', () => {
    assert.strictEqual(coinPackageById('coins-120').coins, 120);
    assert.strictEqual(coinPackageById('nope'), null);
    assert.strictEqual(COIN_PACKAGES.length >= 2, true);
    assert.strictEqual(FREE_LIMITS.detailedSolutionsPerSubject, 1);
    assert.strictEqual(FREE_LIMITS.askMetPerSubject, 1);
    assert.strictEqual(FREE_LIMITS.personalExamsPerWindow, 1);
    assert.strictEqual(FREE_LIMITS.personalExamWindowHours, 24);
    assert.strictEqual(FREE_LIMITS.multiplayerEnabled, false);
    assert.strictEqual(FREE_LIMITS.canPurchaseCoins, false);
    assert.ok(FREE_LIMITS.dailyCoins > 0 && FREE_LIMITS.dailyCoins <= 40);
});

if (failures) {
    console.error(`${failures} failed`);
    process.exit(1);
}
console.log('limits ok');
