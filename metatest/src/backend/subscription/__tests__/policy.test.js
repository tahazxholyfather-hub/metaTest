'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    calculatePricing,
    planIsActive,
    isUnlimitedActive,
    nextReservationStart,
    loyaltyWindowOpen,
    addDays,
    normalizePlanKey,
} = require('../policyMath');

test('pricing stacks plan discount, then loyalty, then coupon', () => {
    const pricing = calculatePricing(
        { price: 100000, plan_discount_percent: 10 },
        { percent: 10 },
        10
    );
    assert.equal(pricing.priceAfterPlanDiscount, 90000);
    assert.equal(pricing.loyaltyDiscountAmount, 9000);
    assert.equal(pricing.priceAfterLoyalty, 81000);
    assert.equal(pricing.couponDiscountAmount, 8100);
    assert.equal(pricing.finalPrice, 72900);
});

test('expired paid plan is inactive and unlimited null expiry stays active', () => {
    const past = new Date(Date.now() - 60 * 1000);
    const future = new Date(Date.now() + 60 * 1000);
    assert.equal(planIsActive('bronze', past), false);
    assert.equal(planIsActive('bronze', future), true);
    assert.equal(planIsActive('free', null), false);
    assert.equal(planIsActive('diamond', null), true);
    assert.equal(isUnlimitedActive('diamond', null), true);
    assert.equal(isUnlimitedActive('bronze', future), false);
    assert.equal(normalizePlanKey('epic'), 'diamond');
    assert.equal(normalizePlanKey('guest_pass'), 'free');
});

test('queue start waits out the active plan and earlier reservations', () => {
    const now = new Date('2026-10-10T00:00:00Z');
    const bronzeEnds = new Date('2026-11-01T00:00:00Z');
    const silverEnds = new Date('2027-02-01T00:00:00Z');
    const start = nextReservationStart(bronzeEnds, [{ endsAt: silverEnds }], now);
    assert.equal(start.toISOString(), silverEnds.toISOString());
    assert.equal(nextReservationStart(bronzeEnds, [{ endsAt: null }], now), null);
    const expected = new Date(start);
    expected.setDate(expected.getDate() + 30);
    assert.equal(addDays(start, 30).getTime(), expected.getTime());
    assert.equal(addDays(now, null), null);
});

test('loyalty window opens only after expiry and only while enabled', () => {
    const expired = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const closed = loyaltyWindowOpen({
        planKey: 'silver',
        expiresAt: expired,
        enabled: false,
        windowHours: 72,
    });
    assert.equal(closed.open, false);
    const open = loyaltyWindowOpen({
        planKey: 'silver',
        expiresAt: expired,
        enabled: true,
        windowHours: 72,
    });
    assert.equal(open.open, true);
    assert.equal(open.fromPlanId, 'silver');
    assert.ok(open.hoursLeft > 60 && open.hoursLeft < 72);
    const tooLate = loyaltyWindowOpen({
        planKey: 'silver',
        expiresAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
        enabled: true,
        windowHours: 72,
    });
    assert.equal(tooLate.open, false);
    const stillActive = loyaltyWindowOpen({
        planKey: 'silver',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        enabled: true,
        windowHours: 72,
    });
    assert.equal(stillActive.open, false);
});
