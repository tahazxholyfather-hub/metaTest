'use strict';

function normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
}

function asBool(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return fallback;
}

function parseExpiry(value) {
    if (value === undefined || value === null || String(value).trim() === '') return { ok: true, value: null };
    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return { ok: false, message: 'Expiry date is invalid.' };
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);
    if (hour > 23 || minute > 59 || second > 59) return { ok: false, message: 'Expiry date is invalid.' };
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (
        date.getFullYear() !== year
        || date.getMonth() !== month - 1
        || date.getDate() !== day
    ) {
        return { ok: false, message: 'Expiry date is invalid.' };
    }
    const pad = (n) => String(n).padStart(2, '0');
    return {
        ok: true,
        value: `${match[1]}-${match[2]}-${match[3]} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    };
}

function expiryToInput(value) {
    if (!value) return '';
    const raw = value instanceof Date
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        : String(value).replace('T', ' ');
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    return match ? `${match[1]}T${match[2]}` : '';
}

function parsePlanIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((id) => String(id));
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
    } catch {
        return [];
    }
}

function validateDiscountPayload(body = {}) {
    const code = normalizeCode(body.code);
    if (!/^[\p{L}\p{N}_-]{2,40}$/u.test(code)) {
        return { ok: false, message: 'Code must be 2–40 letters, numbers, dashes or underscores.' };
    }

    const percent = Number(body.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return { ok: false, message: 'Percent must be greater than 0 and at most 100.' };
    }
    const rounded = Math.round(percent * 100) / 100;

    let maxUses = null;
    const rawMax = body.maxUses !== undefined ? body.maxUses : body.max_uses;
    if (rawMax !== undefined && rawMax !== null && String(rawMax).trim() !== '') {
        const parsed = Number(rawMax);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000000) {
            return { ok: false, message: 'Max uses must be a whole number between 1 and 1,000,000, or empty for unlimited.' };
        }
        maxUses = parsed;
    }

    const expiry = parseExpiry(body.expiresAt !== undefined ? body.expiresAt : body.expires_at);
    if (!expiry.ok) return expiry;

    let allowedPlanIds = null;
    const rawPlans = body.allowedPlanIds !== undefined ? body.allowedPlanIds : body.allowed_plan_ids;
    if (rawPlans !== undefined && rawPlans !== null) {
        if (!Array.isArray(rawPlans)) {
            return { ok: false, message: 'Allowed plans must be a list.' };
        }
        const ids = [...new Set(rawPlans.map((id) => String(id).trim()).filter(Boolean))];
        if (ids.length > 50 || ids.some((id) => id.length > 50)) {
            return { ok: false, message: 'Select at most 50 plans.' };
        }
        allowedPlanIds = ids.length ? ids : null;
    }

    return {
        ok: true,
        value: {
            code,
            percent: rounded,
            active: asBool(body.active, true) ? 1 : 0,
            expiresAt: expiry.value,
            maxUses,
            allowedPlanIds: allowedPlanIds ? JSON.stringify(allowedPlanIds) : null,
        },
    };
}

module.exports = {
    normalizeCode,
    parseExpiry,
    expiryToInput,
    parsePlanIds,
    validateDiscountPayload,
};
