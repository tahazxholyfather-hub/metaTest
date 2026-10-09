'use strict';

/**
 * Free vs paid limits for MetaTest.
 *
 * Change numbers here. Practice, Ask Met, exam builder, and the coin shop
 * all read this module — do not hardcode the same caps next to a feature.
 *
 * Paid = any non-free current_plan that has not expired (named keys such as
 * bronze/silver/golden/diamond, or a numeric subscription_plans id).
 */

const CORE_SUBJECTS = Object.freeze(['math', 'physics', 'chemistry', 'biology']);

const SUBJECT_LABELS = Object.freeze({
    math: 'ریاضی',
    physics: 'فیزیک',
    chemistry: 'شیمی',
    biology: 'زیست‌شناسی',
});

const FREE_LIMITS = Object.freeze({
    /** Detailed practice solutions a free student may open, per subject. */
    detailedSolutionsPerSubject: 1,
    /** Ask Met turns a free student may start, per subject (same question can continue). */
    askMetPerSubject: 1,
    /** Personal (private) exams a free student may create inside the window. */
    personalExamsPerWindow: 1,
    personalExamWindowHours: 24,
    /** Online / multiplayer exam builder and joining a public lobby. */
    multiplayerEnabled: false,
    /** Coin packs require a paid plan. */
    canPurchaseCoins: false,
    /**
     * Daily Met coins for the free plan. A typical chat turn is ~12 coins,
     * so 24 covers about one or two questions. Override with AI_DAILY_FREE_COINS.
     */
    dailyCoins: 24,
});

/** Coin packs. Add a row to extend the shop — the modal and checkout read this list. */
const COIN_PACKAGES = Object.freeze([
    { id: 'coins-40', coins: 40, priceToman: 39000, title: '۴۰ سکه', subtitle: 'گفتگوی کوتاه' },
    { id: 'coins-120', coins: 120, priceToman: 99000, title: '۱۲۰ سکه', subtitle: 'تمرین بیشتر', popular: true },
    { id: 'coins-300', coins: 300, priceToman: 219000, title: '۳۰۰ سکه', subtitle: 'به‌صرفه‌ترین' },
]);

const NAMED_PAID_PLANS = new Set(['bronze', 'silver', 'golden', 'gold', 'diamond', 'epic', 'premium', 'pro']);

function isPaidPlan(planKey, expiresAt) {
    const key = String(planKey ?? '').trim().toLowerCase();
    if (!key || key === 'free' || key === '0' || key === 'null' || key === 'undefined') return false;
    if (expiresAt) {
        const exp = new Date(expiresAt);
        if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) return false;
    }
    if (/^\d+$/.test(key)) return Number(key) > 0;
    if (NAMED_PAID_PLANS.has(key)) return true;
    return true;
}

function subjectBucket(subjectKey, subjectId) {
    const key = String(subjectKey || '').toLowerCase();
    if (CORE_SUBJECTS.includes(key)) return key;
    const id = Number(subjectId);
    if (Number.isFinite(id) && id > 0) return `subject:${id}`;
    return 'general';
}

function subjectLabel(bucket, fallbackTitle) {
    if (SUBJECT_LABELS[bucket]) return SUBJECT_LABELS[bucket];
    const title = String(fallbackTitle || '').trim();
    return title || 'این درس';
}

function coinPackageById(id) {
    return COIN_PACKAGES.find((pack) => pack.id === String(id || '')) || null;
}

module.exports = {
    CORE_SUBJECTS,
    SUBJECT_LABELS,
    FREE_LIMITS,
    COIN_PACKAGES,
    isPaidPlan,
    subjectBucket,
    subjectLabel,
    coinPackageById,
};
