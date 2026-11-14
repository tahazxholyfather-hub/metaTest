'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isActionAllowed, resolveSections } = require('../sections');
const {
    normalizeQuestionText,
    questionFingerprint,
    parsePurgeFilters,
    rowInScope,
    classifyUploads,
    planPurge,
    parseQuestionIds,
    hasHistory,
} = require('../questionMatch');

const STEM = 'کدام گزینه برای تکمیل عبارت زیر مناسب است؟ در بدن انسان نوعی بافت که رشته‌های ضخیم دارد';
const OPTIONS = ['الف', 'ب', 'ج', 'د'];

function dbRow(overrides) {
    return {
        id: 1,
        question_text: STEM,
        options: OPTIONS,
        status: 'فعال',
        insert_type: 'اتوماتیک',
        created_at: '2026-11-02 10:00:00',
        admin_id: 4,
        edit_status: 'done',
        ...overrides,
    };
}

test('normalization ignores zwnj, arabic yeh and kaf, html and digits', () => {
    const left = normalizeQuestionText('بافت&zwnj; پیوندی <b>يک</b> ۱۲');
    const right = normalizeQuestionText('بافت\u200c پیوندی یک 12');
    assert.equal(left, right);
    assert.equal(normalizeQuestionText('کتاب'), normalizeQuestionText('كتاب'));
});

test('fingerprint keeps option order', () => {
    assert.notEqual(questionFingerprint(STEM, OPTIONS), questionFingerprint(STEM, ['ب', 'الف', 'ج', 'د']));
});

test('without a date or admin nothing is preselected', () => {
    const filters = parsePurgeFilters({});
    assert.equal(filters.scoped, false);
    assert.equal(filters.insert_type, 'اتوماتیک');
    assert.equal(rowInScope(dbRow({}), filters), false);
});

test('scope keeps automatic rows inside the window and leaves older or manual copies out', () => {
    const filters = parsePurgeFilters({ from: '2026-11-01', to: '2026-11-03', admin_id: 4 });
    assert.equal(rowInScope(dbRow({}), filters), true);
    assert.equal(rowInScope(dbRow({ created_at: '2026-02-01 09:00:00' }), filters), false);
    assert.equal(rowInScope(dbRow({ insert_type: 'دستی' }), filters), false);
    assert.equal(rowInScope(dbRow({ admin_id: 9 }), filters), false);
});

test('every database copy of one file question is returned', () => {
    const filters = parsePurgeFilters({ from: '2026-11-01', to: '2026-11-14', admin_id: 4 });
    const report = classifyUploads(
        [{ name: 'bio.docx', questions: [{ text: `  ${STEM}  `, options: ['الف ', 'ب', 'ج', 'د'] }] }],
        [
            dbRow({ id: 10 }),
            dbRow({ id: 11, question_text: STEM.replace('کدام', 'كدام'), created_at: '2026-02-01 09:00:00', insert_type: 'دستی' }),
            dbRow({ id: 12, question_text: 'سوال دیگر', options: ['۱', '۲', '۳', '۴'] }),
        ],
        filters
    );
    assert.equal(report.summary.matched_groups, 1);
    assert.equal(report.summary.db_rows, 2);
    assert.deepEqual(report.groups[0].copies.map((copy) => copy.id), [10, 11]);
    assert.equal(report.groups[0].copies[0].in_scope, true);
    assert.equal(report.groups[0].copies[1].in_scope, false);
    assert.equal(report.summary.in_scope, 1);
});

test('a short shared stem is not treated as a near match', () => {
    const filters = parsePurgeFilters({ from: '2026-11-01', to: '2026-11-02' });
    const report = classifyUploads(
        [{ name: 'a.docx', questions: [{ text: 'کدام عبارت درست است؟', options: OPTIONS }] }],
        [dbRow({ id: 3, question_text: 'کدام عبارت درست است؟', options: ['دیگر', 'گزینه', 'سوم', 'چهارم'] })],
        filters
    );
    assert.equal(report.summary.ambiguous, 0);
    assert.equal(report.summary.unmatched, 1);
});

test('same long stem with different options stays ambiguous and unselected', () => {
    const filters = parsePurgeFilters({ from: '2026-11-01', to: '2026-11-02', admin_id: 4 });
    const report = classifyUploads(
        [{ name: 'a.docx', questions: [{ text: STEM, options: ['یک', 'دو', 'سه', 'چهار'] }] }],
        [dbRow({ id: 8 })],
        filters
    );
    assert.equal(report.summary.matched_groups, 0);
    assert.equal(report.summary.ambiguous, 1);
    assert.equal(report.ambiguous[0].candidates[0].id, 8);
    assert.equal(report.summary.in_scope, 0);
});

test('full delete deactivates rows users have touched', () => {
    const planned = planPurge(
        [
            { id: 1, has_history: false },
            { id: 2, has_history: true },
        ],
        'delete'
    );
    assert.deepEqual(planned.plan, [
        { id: 1, action: 'delete' },
        { id: 2, action: 'deactivate' },
    ]);
    const onlyOff = planPurge([{ id: 1, has_history: false }], 'deactivate');
    assert.equal(onlyOff.plan[0].action, 'deactivate');
    assert.equal(hasHistory({ answers: 0, quizzes: 1 }), true);
});

test('question ids are unique positive integers', () => {
    assert.deepEqual(parseQuestionIds([3, '3', 4]).ids, [3, 4]);
    assert.equal(parseQuestionIds([]).error.includes('انتخاب'), true);
    assert.equal(parseQuestionIds([0]).error.includes('نامعتبر'), true);
});

test('only the main admin can purge imported questions', () => {
    const staff = { id: 4, sections: resolveSections(4, []) };
    const main = { id: 1, isSuper: true, sections: resolveSections(1, []) };
    assert.equal(isActionAllowed(staff, 'Admin_preview_question_purge'), false);
    assert.equal(isActionAllowed(staff, 'Admin_apply_question_purge'), false);
    assert.equal(isActionAllowed(main, 'Admin_preview_question_purge'), true);
    assert.equal(isActionAllowed(main, 'Admin_apply_question_purge'), true);
});
