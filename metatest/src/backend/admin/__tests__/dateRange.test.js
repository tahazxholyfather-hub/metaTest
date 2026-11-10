'use strict';

const assert = require('node:assert/strict');
const { parseDateRange, sqlBounds, addDays } = require('../dateRange');

assert.deepEqual(parseDateRange({}), {
    from: null,
    to: null,
    toExclusive: null,
    active: false,
});

const swapped = parseDateRange({ from: '2026-03-10', to: '2026-03-01' });
assert.equal(swapped.from, '2026-03-01');
assert.equal(swapped.to, '2026-03-10');
assert.equal(swapped.toExclusive, '2026-03-11');
assert.equal(swapped.active, true);

assert.equal(parseDateRange({ from: '2026-02-31' }).error, 'تاریخ شروع نامعتبر است.');
assert.equal(parseDateRange({ to: 'yesterday' }).error, 'تاریخ پایان نامعتبر است.');
assert.equal(addDays('2026-02-28', 1), '2026-03-01');

const open = sqlBounds('created_at', parseDateRange({ from: '2026-02-01' }));
assert.equal(open.sql, 'created_at >= ?');
assert.deepEqual(open.params, ['2026-02-01 00:00:00']);

const closed = sqlBounds('COALESCE(q.created_at, e.created_at)', parseDateRange({ from: '2026-02-01', to: '2026-02-05' }));
assert.equal(closed.sql, 'COALESCE(q.created_at, e.created_at) >= ? AND COALESCE(q.created_at, e.created_at) < ?');
assert.deepEqual(closed.params, ['2026-02-01 00:00:00', '2026-02-06 00:00:00']);
assert.deepEqual(sqlBounds('created_at', parseDateRange({})), { sql: '1=1', params: [] });

console.log('date range ok');
