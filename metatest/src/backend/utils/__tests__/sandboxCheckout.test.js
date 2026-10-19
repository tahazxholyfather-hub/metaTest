'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandboxToken, readSandboxToken, validateCard, checkoutPath } = require('../sandboxCheckout');

test('sandbox token round-trips the payment', () => {
    const token = createSandboxToken({
        kind: 'plan',
        id: 12,
        authority: 'A00000000000000000000000000123456789',
        amountToman: 697000,
        title: 'اشتراک نقره‌ای',
    });
    const payload = readSandboxToken(token);
    assert.equal(payload.kind, 'plan');
    assert.equal(payload.id, 12);
    assert.equal(payload.amountToman, 697000);
    assert.equal(readSandboxToken(`${token}x`), null);
    assert.match(checkoutPath({ kind: 'coins', id: 3, authority: 'AUTH', amountToman: 1000, title: 'سکه' }), /^\/api\/payments\/sandbox\/checkout\?token=/);
});

test('local card form accepts a 16-digit test card', () => {
    assert.equal(validateCard({ card: '6037 9977 1234 5678', expiry: '08/09', cvv: '123' }), '');
    assert.match(validateCard({ card: '1234', expiry: '08/09', cvv: '123' }), /۱۶/);
    assert.match(validateCard({ card: '6037997712345678', expiry: '13/09', cvv: '123' }), /ماه/);
});
