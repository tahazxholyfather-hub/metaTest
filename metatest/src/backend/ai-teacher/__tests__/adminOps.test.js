'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveSections,
    sectionAllowed,
    isActionAllowed,
    sanitizeSectionPatch,
} = require('../../admin/sections');
const { countWords, wordDelta } = require('../../admin/words');
const { validateDiscountPayload, parseExpiry } = require('../../admin/discounts');

test('word counts keep Persian words and ZWNJ together', () => {
    assert.equal(countWords('سلام دنیا'), 2);
    assert.equal(countWords('نیم‌فاصله'), 1);
    assert.equal(countWords('<p>Hello&nbsp;world</p>'), 2);
    assert.equal(countWords(''), 0);
});

test('word delta counts added and removed words', () => {
    assert.equal(wordDelta('یک دو سه', 'یک دو سه'), 0);
    assert.equal(wordDelta('یک دو', 'یک دو سه'), 1);
    assert.equal(wordDelta('Hello world', 'hello there'), 2);
    assert.equal(wordDelta('', 'گزینه اول'), 2);
});

test('section defaults and super override', () => {
    const staff = resolveSections(4, []);
    assert.equal(staff.dashboard, true);
    assert.equal(staff['edit-questions'], true);
    assert.equal(staff.reports, true);
    assert.equal(staff['word-stats'], true);
    assert.equal(staff['discount-codes'], undefined);
    assert.equal(staff['referral-settings'], undefined);
    assert.equal(staff.withdrawals, undefined);
    assert.equal(staff['ai-manager'], false);
    assert.equal(staff.admins, false);
    assert.equal(staff.access, false);

    const saved = resolveSections(4, [
        { section_key: 'reports', allowed: 0 },
        { section_key: 'ai-manager', allowed: 1 },
    ]);
    assert.equal(saved.reports, false);
    assert.equal(saved['ai-manager'], true);
    assert.equal(saved.dashboard, true);

    const superSections = resolveSections(1, [{ section_key: 'dashboard', allowed: 0 }]);
    assert.equal(superSections.dashboard, true);
    assert.equal(superSections.access, true);
    assert.equal(superSections['ai-manager'], true);
});

test('flow actions follow section grants', () => {
    const reporter = {
        id: 3,
        sections: resolveSections(3, [
            { section_key: 'edit-questions', allowed: 0 },
            { section_key: 'reports', allowed: 1 },
        ]),
    };
    assert.equal(isActionAllowed(reporter, 'Admin_full_update_question'), true);
    assert.equal(isActionAllowed(reporter, 'Admin_insert_questions'), true);
    reporter.sections['insert-questions'] = false;
    assert.equal(isActionAllowed(reporter, 'Admin_insert_questions'), false);
    assert.equal(isActionAllowed(reporter, 'Admin_get_subjects'), true);
    assert.equal(isActionAllowed({ id: 8, sections: { dashboard: true } }, 'not_an_admin_action'), true);
    assert.equal(sectionAllowed({ id: 1, isSuper: true, sections: { reports: false } }, ['reports']), true);
});

test('section patch only keeps known keys', () => {
    const patch = sanitizeSectionPatch({
        dashboard: false,
        access: true,
        'ai-manager': 'true',
        unknown: true,
    });
    assert.deepEqual(patch, { dashboard: false, 'ai-manager': true });
    assert.equal(sanitizeSectionPatch({}), null);
    assert.equal(sanitizeSectionPatch(null), null);
});

test('discount payload validation', () => {
    const ok = validateDiscountPayload({
        code: ' save-10 ',
        percent: 10.5,
        maxUses: '',
        expiresAt: '2026-12-01T18:30',
        allowedPlanIds: ['monthly', 'monthly'],
        active: true,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.value.code, 'SAVE-10');
    assert.equal(ok.value.percent, 10.5);
    assert.equal(ok.value.maxUses, null);
    assert.equal(ok.value.expiresAt, '2026-12-01 18:30:00');
    assert.equal(ok.value.allowedPlanIds, JSON.stringify(['monthly']));

    assert.equal(validateDiscountPayload({ code: 'A', percent: 10 }).ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 0 }).ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 101 }).ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 5, maxUses: 1.5 }).ok, false);
    assert.equal(parseExpiry('2026-02-31T10:00').ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 5, active: 'false' }).value.active, 0);
});
