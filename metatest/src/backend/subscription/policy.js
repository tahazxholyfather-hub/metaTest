'use strict';

const pool = require('../db');
const {
    normalizePlanKey,
    planIsActive,
    isUnlimitedActive,
    addDays,
    calculatePricing,
    nextReservationStart,
    loyaltyWindowOpen,
} = require('./policyMath');

const PLAN_IDS = ['bronze', 'silver', 'golden', 'diamond'];
const DEFAULT_LOYALTY = [
    ['silver', 'silver', 10],
    ['silver', 'golden', 5],
    ['silver', 'bronze', 5],
];

let ready = null;

async function columnExists(table, column) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return Number(rows[0]?.c || 0) > 0;
}

async function ensureInner() {
    const [tables] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans'`
    );
    if (!Number(tables[0]?.c || 0)) return;

    if (!(await columnExists('subscription_plans', 'purchasable'))) {
        await pool.query(
            `ALTER TABLE subscription_plans ADD COLUMN purchasable TINYINT NOT NULL DEFAULT 1`
        );
    }

    const [daysCol] = await pool.query(
        `SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'days'`
    );
    if (daysCol[0] && String(daysCol[0].nullable).toUpperCase() !== 'YES') {
        await pool.query(`ALTER TABLE subscription_plans MODIFY days INT NULL`);
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_settings (
            id TINYINT NOT NULL PRIMARY KEY,
            queue_enabled TINYINT NOT NULL DEFAULT 1,
            loyalty_enabled TINYINT NOT NULL DEFAULT 0,
            loyalty_window_hours INT NOT NULL DEFAULT 72,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_loyalty_rules (
            from_plan_id VARCHAR(64) NOT NULL,
            to_plan_id VARCHAR(64) NOT NULL,
            percent DECIMAL(5,2) NOT NULL DEFAULT 0,
            PRIMARY KEY (from_plan_id, to_plan_id)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_reservations (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            plan_id VARCHAR(64) NOT NULL,
            payment_id INT NULL,
            starts_at DATETIME NOT NULL,
            ends_at DATETIME NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'queued',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_sub_res_user (user_id, status, starts_at)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_schema_flags (
            flag VARCHAR(64) NOT NULL PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(
        `INSERT IGNORE INTO subscription_settings (id, queue_enabled, loyalty_enabled, loyalty_window_hours)
         VALUES (1, 1, 0, 72)`
    );

    const [diamondFlag] = await pool.query(
        `SELECT flag FROM subscription_schema_flags WHERE flag = 'diamond_v1' LIMIT 1`
    );
    if (!diamondFlag.length) {
        const [existing] = await pool.query(
            `SELECT id FROM subscription_plans WHERE id = 'diamond' LIMIT 1`
        );
        if (existing.length) {
            await pool.query(
                `UPDATE subscription_plans
                 SET days = NULL, price = 10000000, is_active = 1, purchasable = 0
                 WHERE id = 'diamond'`
            );
        } else {
            await pool.query(
                `INSERT INTO subscription_plans
                    (id, name, days, price, plan_discount_percent, icon_primary, icon_secondary,
                     shimmer_class, active_shadow, active_border, popular, is_active, purchasable, sort_order)
                 VALUES ('diamond', 'اشتراک الماسی', NULL, 10000000, 0, '#38bdf8', '#1d4ed8',
                         'shimmer-diamond', 'shadow-[0_0_25px_rgba(56,189,248,0.15)]', 'border-sky-500/60',
                         0, 1, 0, 4)`
            );
        }
        await pool.query(`INSERT IGNORE INTO subscription_schema_flags (flag) VALUES ('diamond_v1')`);
        console.log('[plans] اشتراک الماسی نامحدود، ده میلیون تومان، قابل نمایش و غیرقابل خرید شد');
    }

    const [loyaltyFlag] = await pool.query(
        `SELECT flag FROM subscription_schema_flags WHERE flag = 'loyalty_matrix_v1' LIMIT 1`
    );
    if (!loyaltyFlag.length) {
        for (const fromId of PLAN_IDS) {
            for (const toId of PLAN_IDS) {
                const preset = DEFAULT_LOYALTY.find((row) => row[0] === fromId && row[1] === toId);
                const percent = preset ? preset[2] : 0;
                await pool.query(
                    `INSERT IGNORE INTO subscription_loyalty_rules (from_plan_id, to_plan_id, percent)
                     VALUES (?, ?, ?)`,
                    [fromId, toId, percent]
                );
            }
        }
        await pool.query(`INSERT IGNORE INTO subscription_schema_flags (flag) VALUES ('loyalty_matrix_v1')`);
    }
}

function ensureSubscriptionCatalog() {
    if (!ready) {
        ready = ensureInner().catch((err) => {
            ready = null;
            if (err && err.code === 'ER_NO_SUCH_TABLE') return;
            console.error('[plans] catalog', err.message);
            throw err;
        });
    }
    return ready;
}

async function loadSettings(db) {
    try {
        const [rows] = await db.query(
            `SELECT queue_enabled, loyalty_enabled, loyalty_window_hours
             FROM subscription_settings WHERE id = 1 LIMIT 1`
        );
        const row = rows[0];
        if (!row) {
            return { queueEnabled: true, loyaltyEnabled: false, loyaltyWindowHours: 72 };
        }
        return {
            queueEnabled: Number(row.queue_enabled) === 1,
            loyaltyEnabled: Number(row.loyalty_enabled) === 1,
            loyaltyWindowHours: Number(row.loyalty_window_hours) || 72,
        };
    } catch (err) {
        if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR')) {
            return { queueEnabled: true, loyaltyEnabled: false, loyaltyWindowHours: 72 };
        }
        throw err;
    }
}

async function listQueuedRaw(db, userId) {
    const [rows] = await db.query(
        `SELECT id, plan_id, payment_id, starts_at, ends_at, status
         FROM subscription_reservations
         WHERE user_id = ? AND status = 'queued'
         ORDER BY starts_at ASC, id ASC`,
        [userId]
    );
    return rows;
}

async function promoteDueReservations(userId, connection) {
    const own = !connection;
    const db = connection || await pool.getConnection();
    let opened = false;
    try {
        if (own) {
            await db.beginTransaction();
            opened = true;
        }
        const [users] = await db.query(
            `SELECT id, current_plan, plan_expires_at FROM tam24_users WHERE id = ? LIMIT 1 FOR UPDATE`,
            [userId]
        );
        const user = users[0];
        if (!user || planIsActive(user.current_plan, user.plan_expires_at)) {
            if (own) await db.commit();
            return { promoted: false, user: user || null };
        }
        const [due] = await db.query(
            `SELECT id, plan_id, starts_at, ends_at
             FROM subscription_reservations
             WHERE user_id = ? AND status = 'queued' AND starts_at <= NOW()
             ORDER BY starts_at ASC, id ASC
             LIMIT 1
             FOR UPDATE`,
            [userId]
        );
        const next = due[0];
        if (!next) {
            if (own) await db.commit();
            return { promoted: false, user };
        }
        await db.query(
            `UPDATE tam24_users SET current_plan = ?, plan_expires_at = ?, updated_at = NOW() WHERE id = ?`,
            [next.plan_id, next.ends_at, userId]
        );
        await db.query(
            `UPDATE subscription_reservations SET status = 'activated' WHERE id = ?`,
            [next.id]
        );
        if (own) await db.commit();
        return { promoted: true, planId: next.plan_id, endsAt: next.ends_at };
    } catch (err) {
        if (own && opened) {
            try { await db.rollback(); } catch (_) { /* already closed */ }
        }
        if (err && err.code === 'ER_NO_SUCH_TABLE') return { promoted: false };
        throw err;
    } finally {
        if (own) db.release();
    }
}

async function rechainQueued(db, userId, firstStart) {
    const [rows] = await db.query(
        `SELECT id, starts_at, ends_at
         FROM subscription_reservations
         WHERE user_id = ? AND status = 'queued'
         ORDER BY starts_at ASC, id ASC
         FOR UPDATE`,
        [userId]
    );
    let cursor = new Date(firstStart);
    for (const row of rows) {
        const duration = row.ends_at == null
            ? null
            : new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime();
        const starts = new Date(cursor);
        const ends = duration == null || !Number.isFinite(duration) ? null : new Date(starts.getTime() + duration);
        await db.query(
            `UPDATE subscription_reservations SET starts_at = ?, ends_at = ? WHERE id = ?`,
            [starts, ends, row.id]
        );
        if (!ends) break;
        cursor = ends;
    }
}

async function assertCanPurchase(db, userId) {
    await promoteDueReservations(userId, db);
    const [users] = await db.query(
        `SELECT id, current_plan, plan_expires_at FROM tam24_users WHERE id = ? LIMIT 1 FOR UPDATE`,
        [userId]
    );
    const user = users[0];
    if (!user) return { ok: false, status: 404, message: 'کاربر یافت نشد' };
    if (isUnlimitedActive(user.current_plan, user.plan_expires_at)) {
        return { ok: false, status: 400, message: 'اشتراک نامحدود شما فعال است و نیازی به خرید پلن جدید نیست.' };
    }
    const settings = await loadSettings(db);
    if (planIsActive(user.current_plan, user.plan_expires_at) && settings.queueEnabled) {
        const queued = await listQueuedRaw(db, userId);
        if (!nextReservationStart(user.plan_expires_at, queued)) {
            return { ok: false, status: 400, message: 'یک اشتراک نامحدود در صف رزرو شماست.' };
        }
    }
    return { ok: true };
}

async function applyPaidPlan(db, { userId, plan, paymentId }) {
    await promoteDueReservations(userId, db);
    const [users] = await db.query(
        `SELECT id, current_plan, plan_expires_at FROM tam24_users WHERE id = ? LIMIT 1 FOR UPDATE`,
        [userId]
    );
    const user = users[0];
    if (!user) {
        const err = new Error('کاربر یافت نشد');
        err.status = 404;
        err.expose = true;
        throw err;
    }
    const settings = await loadSettings(db);
    const active = planIsActive(user.current_plan, user.plan_expires_at);
    const unlimitedNow = isUnlimitedActive(user.current_plan, user.plan_expires_at);
    const queued = await listQueuedRaw(db, userId);
    const days = plan.days == null ? null : Number(plan.days);
    const shouldQueue = active && (settings.queueEnabled || unlimitedNow);

    if (shouldQueue) {
        const start = nextReservationStart(user.plan_expires_at, queued);
        if (!start) {
            const err = new Error('یک اشتراک نامحدود در صف رزرو شماست.');
            err.status = 400;
            err.expose = true;
            throw err;
        }
        const end = addDays(start, days);
        await db.query(
            `INSERT INTO subscription_reservations (user_id, plan_id, payment_id, starts_at, ends_at, status)
             VALUES (?, ?, ?, ?, ?, 'queued')`,
            [userId, plan.id, paymentId || null, start, end]
        );
        return { queued: true, startsAt: start, endsAt: end, expiresAt: user.plan_expires_at };
    }

    const start = new Date();
    const end = addDays(start, days);
    await db.query(
        `UPDATE tam24_users SET current_plan = ?, plan_expires_at = ?, updated_at = NOW() WHERE id = ?`,
        [plan.id, end, userId]
    );
    if (end && queued.length) await rechainQueued(db, userId, end);
    return { queued: false, startsAt: start, endsAt: end, expiresAt: end };
}

async function loyaltyContext(db, userId) {
    const settings = await loadSettings(db);
    const base = {
        enabled: settings.loyaltyEnabled,
        windowHours: settings.loyaltyWindowHours,
        open: false,
        fromPlanId: null,
        fromPlanName: null,
        hoursLeft: null,
        rules: {},
    };
    if (!userId) {
        base.queueEnabled = settings.queueEnabled;
        return base;
    }
    const [rows] = await db.query(
        `SELECT current_plan, plan_expires_at FROM tam24_users WHERE id = ? LIMIT 1`,
        [userId]
    );
    const user = rows[0];
    base.queueEnabled = settings.queueEnabled;
    if (!user) return base;
    const window = loyaltyWindowOpen({
        planKey: user.current_plan,
        expiresAt: user.plan_expires_at,
        enabled: settings.loyaltyEnabled,
        windowHours: settings.loyaltyWindowHours,
    });
    base.open = window.open;
    base.fromPlanId = window.open ? window.fromPlanId : null;
    base.hoursLeft = window.open && window.hoursLeft != null ? Math.ceil(window.hoursLeft) : null;
    if (!window.open || !window.fromPlanId) return base;
    const [rules] = await db.query(
        `SELECT to_plan_id, percent FROM subscription_loyalty_rules WHERE from_plan_id = ?`,
        [window.fromPlanId]
    );
    for (const rule of rules) base.rules[String(rule.to_plan_id)] = Number(rule.percent) || 0;
    const [names] = await db.query(
        `SELECT name FROM subscription_plans WHERE id = ? LIMIT 1`,
        [window.fromPlanId]
    );
    base.fromPlanName = names[0]?.name || window.fromPlanId;
    return base;
}

function mapReservation(row) {
    return {
        id: row.id,
        planId: row.plan_id,
        planName: row.plan_name || row.plan_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        unlimited: row.ends_at == null,
    };
}

async function subscriptionSnapshot(userId) {
    await promoteDueReservations(userId);
    const [rows] = await pool.query(
        `SELECT id, current_plan, plan_expires_at FROM tam24_users WHERE id = ? LIMIT 1`,
        [userId]
    );
    const user = rows[0];
    if (!user) return null;
    const settings = await loadSettings(pool);
    const active = planIsActive(user.current_plan, user.plan_expires_at);
    const key = normalizePlanKey(user.current_plan);
    const unlimited = isUnlimitedActive(user.current_plan, user.plan_expires_at);
    let daysRemaining = 0;
    if (active && user.plan_expires_at) {
        daysRemaining = Math.max(0, Math.ceil((new Date(user.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    let planName = null;
    if (key !== 'free') {
        const [names] = await pool.query(
            `SELECT name FROM subscription_plans WHERE id = ? LIMIT 1`,
            [user.current_plan]
        );
        planName = names[0]?.name || user.current_plan;
    }
    let queue = [];
    try {
        const [queued] = await pool.query(
            `SELECT r.id, r.plan_id, r.starts_at, r.ends_at, COALESCE(p.name, r.plan_id) AS plan_name
             FROM subscription_reservations r
             LEFT JOIN subscription_plans p ON p.id = r.plan_id
             WHERE r.user_id = ? AND r.status = 'queued'
             ORDER BY r.starts_at ASC, r.id ASC`,
            [userId]
        );
        queue = queued.map(mapReservation);
    } catch (err) {
        if (!err || err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
    const loyalty = await loyaltyContext(pool, userId);
    return {
        currentPlan: active ? (user.current_plan || 'free') : 'free',
        storedPlan: user.current_plan,
        planName: active ? planName : null,
        planExpiresAt: active ? user.plan_expires_at : null,
        isActive: active,
        unlimited,
        daysRemaining: unlimited ? null : daysRemaining,
        expiredPlan: !active && key !== 'free'
            ? { id: user.current_plan, name: planName, expiredAt: user.plan_expires_at }
            : null,
        queue,
        queueEnabled: settings.queueEnabled,
        loyalty,
    };
}

function publicPlan(row, loyaltyPercent) {
    const days = row.days == null ? null : Number(row.days);
    return {
        id: row.id,
        name: row.name,
        days,
        unlimited: days == null,
        price: Number(row.price),
        planDiscountPercent: Number(row.plan_discount_percent || 0),
        purchasable: Number(row.purchasable) !== 0,
        iconColors: { primary: row.icon_primary, secondary: row.icon_secondary },
        shimmerClass: row.shimmer_class,
        activeShadow: row.active_shadow,
        activeBorder: row.active_border,
        popular: Boolean(row.popular),
        loyaltyPercent: Number(loyaltyPercent) || 0,
    };
}

module.exports = {
    PLAN_IDS,
    normalizePlanKey,
    planIsActive,
    isUnlimitedActive,
    addDays,
    calculatePricing,
    nextReservationStart,
    loyaltyWindowOpen,
    ensureSubscriptionCatalog,
    loadSettings,
    promoteDueReservations,
    assertCanPurchase,
    applyPaidPlan,
    loyaltyContext,
    subscriptionSnapshot,
    publicPlan,
};
