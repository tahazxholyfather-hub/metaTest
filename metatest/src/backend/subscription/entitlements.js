'use strict';

const pool = require('../db');
const { subjectKeyFromText } = require('../ai-teacher/subjects');
const {
    FREE_LIMITS, isPaidPlan, subjectBucket, subjectLabel,
} = require('./limits');
const usage = require('./usage');

async function loadPlan(userId) {
    const id = Number(userId);
    if (!id) return { userId: null, planKey: 'free', expiresAt: null, paid: false };
    const [rows] = await pool.query(
        `SELECT current_plan, plan_expires_at FROM tam24_users WHERE id = ? LIMIT 1`,
        [id]
    );
    const row = rows[0] || {};
    const planKey = row.current_plan || 'free';
    const expiresAt = row.plan_expires_at || null;
    return { userId: id, planKey, expiresAt, paid: isPaidPlan(planKey, expiresAt) };
}

function unlimitedSlot() {
    return { allowed: true, already: false, used: 0, limit: null, remaining: null, nextAllowedAt: null };
}

async function forUser(userId) {
    const plan = await loadPlan(userId);
    if (plan.paid) {
        return {
            planKey: String(plan.planKey || 'pro'),
            isPaid: true,
            multiplayer: true,
            canPurchaseCoins: true,
            limits: {
                detailedSolutionsPerSubject: null,
                askMetPerSubject: null,
                personalExamsPerWindow: null,
                personalExamWindowHours: FREE_LIMITS.personalExamWindowHours,
                dailyCoins: null,
            },
            solutions: {},
            askMet: {},
            personalExam: unlimitedSlot(),
        };
    }

    const snap = plan.userId ? await usage.snapshot(plan.userId) : { solutions: {}, askMet: {}, personalExam: unlimitedSlot() };
    return {
        planKey: 'free',
        isPaid: false,
        multiplayer: FREE_LIMITS.multiplayerEnabled,
        canPurchaseCoins: FREE_LIMITS.canPurchaseCoins,
        limits: {
            detailedSolutionsPerSubject: FREE_LIMITS.detailedSolutionsPerSubject,
            askMetPerSubject: FREE_LIMITS.askMetPerSubject,
            personalExamsPerWindow: FREE_LIMITS.personalExamsPerWindow,
            personalExamWindowHours: FREE_LIMITS.personalExamWindowHours,
            dailyCoins: FREE_LIMITS.dailyCoins,
        },
        solutions: snap.solutions,
        askMet: snap.askMet,
        personalExam: snap.personalExam,
    };
}

/**
 * Paid plans always receive the text. Free plans spend one slot per subject.
 * The slot is committed on its own connection, before the answer transaction.
 */
async function consumeSolution(_conn, { userId, subjectTitle, subjectId, questionId }) {
    const plan = await loadPlan(userId);
    const key = subjectKeyFromText(subjectTitle || '') || null;
    const bucket = subjectBucket(key, subjectId);
    const label = subjectLabel(bucket, subjectTitle);
    if (plan.paid) {
        return { allowed: true, locked: false, subjectKey: bucket, subjectLabel: label, used: 0, limit: null, remaining: null };
    }
    if (!plan.userId) {
        return { allowed: false, locked: true, subjectKey: bucket, subjectLabel: label, used: 0, limit: FREE_LIMITS.detailedSolutionsPerSubject, remaining: 0 };
    }
    await usage.ensureReady();
    // Own connection so the slot commits before the answer transaction does.
    // Holding it inside that transaction would roll the slot back with a failed
    // answer, and releasing the lock before commit would let a second request through.
    const own = await pool.getConnection();
    try {
        await own.beginTransaction();
        const slot = await usage.consumeSubjectSlot(own, {
            userId: plan.userId,
            feature: 'detailed_solution',
            subjectKey: bucket,
            resourceId: String(questionId),
            limit: FREE_LIMITS.detailedSolutionsPerSubject,
        }, { commit: true });
        return {
            allowed: slot.allowed,
            locked: !slot.allowed,
            subjectKey: bucket,
            subjectLabel: label,
            used: slot.used,
            limit: slot.limit,
            remaining: slot.remaining,
        };
    } catch (err) {
        try { await own.rollback(); } catch { /* committed or unused */ }
        throw err;
    } finally {
        own.release();
    }
}

async function consumeAskMet(_conn, { userId, subjectKey, subjectTitle, subjectId, questionId }) {
    const plan = await loadPlan(userId);
    const bucket = subjectBucket(subjectKey || subjectKeyFromText(subjectTitle || ''), subjectId);
    const label = subjectLabel(bucket, subjectTitle);
    if (plan.paid) {
        return { allowed: true, locked: false, subjectKey: bucket, subjectLabel: label };
    }
    await usage.ensureReady();
    const own = await pool.getConnection();
    try {
        await own.beginTransaction();
        const slot = await usage.consumeSubjectSlot(own, {
            userId: plan.userId,
            feature: 'ask_met',
            subjectKey: bucket,
            resourceId: String(questionId),
            limit: FREE_LIMITS.askMetPerSubject,
        }, { commit: true });
        return {
            allowed: slot.allowed,
            locked: !slot.allowed,
            subjectKey: bucket,
            subjectLabel: label,
            used: slot.used,
            limit: slot.limit,
            remaining: slot.remaining,
        };
    } catch (err) {
        try { await own.rollback(); } catch { /* committed or unused */ }
        throw err;
    } finally {
        own.release();
    }
}

async function prepareExamCreate(userId, visibility) {
    const plan = await loadPlan(userId);
    const vis = String(visibility || 'private') === 'public' ? 'public' : 'private';
    if (plan.paid) return { ok: true, record: false, visibility: vis };
    if (vis === 'public') {
        return {
            ok: false,
            code: 'MULTIPLAYER_LOCKED',
            message: 'آزمون آنلاین با اشتراک ویژه فعال می‌شود.',
        };
    }
    await usage.ensureReady();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const slot = await usage.claimWindowSlot(conn, {
            userId: plan.userId,
            feature: 'personal_exam',
            limit: FREE_LIMITS.personalExamsPerWindow,
            windowHours: FREE_LIMITS.personalExamWindowHours,
        }, { commit: true });
        if (!slot.allowed) {
            return {
                ok: false,
                code: 'PERSONAL_EXAM_COOLDOWN',
                message: 'با اشتراک رایگان، هر ۲۴ ساعت یک آزمون شخصی می‌سازید.',
                nextAllowedAt: slot.nextAllowedAt,
            };
        }
        return { ok: true, record: true, usageId: slot.usageId, visibility: vis };
    } catch (err) {
        try { await conn.rollback(); } catch { /* committed or unused */ }
        throw err;
    } finally {
        conn.release();
    }
}

async function multiplayerBlocked(userId) {
    const plan = await loadPlan(userId);
    return !plan.paid && !FREE_LIMITS.multiplayerEnabled;
}

module.exports = {
    loadPlan,
    forUser,
    consumeSolution,
    consumeAskMet,
    prepareExamCreate,
    multiplayerBlocked,
};
