'use strict';

function normalizePlanKey(planKey) {
    const key = String(planKey ?? '').trim().toLowerCase();
    if (!key || key === 'free' || key === '0' || key === 'null' || key === 'undefined' || key === 'guest_pass') {
        return 'free';
    }
    if (key === 'epic') return 'diamond';
    if (key === 'gold') return 'golden';
    return key;
}

function planIsActive(planKey, expiresAt, now = new Date()) {
    if (normalizePlanKey(planKey) === 'free') return false;
    if (expiresAt == null || expiresAt === '') return true;
    const exp = new Date(expiresAt);
    if (Number.isNaN(exp.getTime())) return false;
    return exp.getTime() > now.getTime();
}

function isUnlimitedActive(planKey, expiresAt, now = new Date()) {
    return planIsActive(planKey, expiresAt, now) && (expiresAt == null || expiresAt === '');
}

function addDays(start, days) {
    if (days == null || days === '') return null;
    const count = Number(days);
    if (!Number.isFinite(count)) return null;
    const next = new Date(start);
    next.setDate(next.getDate() + count);
    return next;
}

function calculatePricing(plan, coupon, loyaltyPercent = 0) {
    // The stored price is what the student pays. compare_price is only the
    // crossed figure an admin typed. A percent never reduces the charge.
    const payPrice = Math.max(0, Math.round(Number(plan.price) || 0));
    const listed = Math.round(Number(plan.compare_price ?? plan.comparePrice ?? 0) || 0);
    const comparePrice = listed > payPrice ? listed : null;
    const planDiscountAmount = comparePrice ? comparePrice - payPrice : 0;
    const planDiscountPercent = comparePrice ? Math.round((planDiscountAmount / comparePrice) * 100) : 0;
    const priceAfterPlanDiscount = payPrice;

    const loyalty = Math.min(100, Math.max(0, Number(loyaltyPercent) || 0));
    const loyaltyDiscountAmount = Math.round((priceAfterPlanDiscount * loyalty) / 100);
    const priceAfterLoyalty = Math.max(0, priceAfterPlanDiscount - loyaltyDiscountAmount);

    const couponPercent = coupon ? Number(coupon.percent || 0) : 0;
    const couponDiscountAmount = Math.round((priceAfterLoyalty * couponPercent) / 100);
    const finalPrice = Math.max(0, priceAfterLoyalty - couponDiscountAmount);

    return {
        basePrice: comparePrice || payPrice,
        payPrice,
        comparePrice,
        planDiscountPercent,
        planDiscountAmount,
        priceAfterPlanDiscount,
        loyaltyPercent: loyalty,
        loyaltyDiscountAmount,
        priceAfterLoyalty,
        couponPercent,
        couponDiscountAmount,
        finalPrice,
    };
}

function nextReservationStart(activeExpiresAt, queued, now = new Date()) {
    let cursor = activeExpiresAt ? new Date(activeExpiresAt) : new Date(now);
    if (Number.isNaN(cursor.getTime()) || cursor < now) cursor = new Date(now);
    for (const row of queued || []) {
        const endValue = row.endsAt !== undefined ? row.endsAt : row.ends_at;
        if (endValue == null) return null;
        const end = new Date(endValue);
        if (!Number.isNaN(end.getTime()) && end > cursor) cursor = end;
    }
    return cursor;
}

function loyaltyWindowOpen({ planKey, expiresAt, enabled, windowHours, now = new Date() }) {
    const fromPlanId = normalizePlanKey(planKey);
    if (!enabled || fromPlanId === 'free') {
        return { open: false, fromPlanId: fromPlanId === 'free' ? null : fromPlanId, hoursLeft: null };
    }
    if (planIsActive(planKey, expiresAt, now) || expiresAt == null || expiresAt === '') {
        return { open: false, fromPlanId, hoursLeft: null };
    }
    const expiredAt = new Date(expiresAt);
    if (Number.isNaN(expiredAt.getTime())) return { open: false, fromPlanId, hoursLeft: null };
    const hours = Number(windowHours);
    if (!Number.isFinite(hours) || hours <= 0) return { open: false, fromPlanId, hoursLeft: null };
    const deadline = expiredAt.getTime() + hours * 60 * 60 * 1000;
    if (now.getTime() > deadline) return { open: false, fromPlanId, hoursLeft: 0 };
    return {
        open: true,
        fromPlanId,
        hoursLeft: Math.max(0, (deadline - now.getTime()) / (60 * 60 * 1000)),
    };
}

module.exports = {
    normalizePlanKey,
    planIsActive,
    isUnlimitedActive,
    addDays,
    calculatePricing,
    nextReservationStart,
    loyaltyWindowOpen,
};
