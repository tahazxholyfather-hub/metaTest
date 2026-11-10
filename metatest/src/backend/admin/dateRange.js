'use strict';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const match = DAY.exec(text);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return text;
}

function addDays(iso, days) {
    const match = DAY.exec(iso);
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Inclusive civil dates from the query. `toExclusive` is the next day, so the
 * end date itself stays inside the range.
 */
function parseDateRange(query = {}) {
    const fromRaw = String(query.from || '').trim();
    const toRaw = String(query.to || '').trim();
    const fromDay = parseDay(fromRaw);
    const toDay = parseDay(toRaw);
    if (fromRaw && !fromDay) return { error: 'تاریخ شروع نامعتبر است.' };
    if (toRaw && !toDay) return { error: 'تاریخ پایان نامعتبر است.' };

    let from = fromDay;
    let to = toDay;
    if (from && to && from > to) {
        const swap = from;
        from = to;
        to = swap;
    }

    return {
        from,
        to,
        toExclusive: to ? addDays(to, 1) : null,
        active: Boolean(from || to),
    };
}

function sqlBounds(expression, range) {
    const parts = [];
    const params = [];
    if (range && range.from) {
        parts.push(`${expression} >= ?`);
        params.push(`${range.from} 00:00:00`);
    }
    if (range && range.toExclusive) {
        parts.push(`${expression} < ?`);
        params.push(`${range.toExclusive} 00:00:00`);
    }
    return { sql: parts.length ? parts.join(' AND ') : '1=1', params };
}

module.exports = {
    parseDay,
    addDays,
    parseDateRange,
    sqlBounds,
};
