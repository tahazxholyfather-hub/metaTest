'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPayableGatewayPage } = require('../gatewayPage');

test('accepts the Persian checkout page', () => {
    const html = '<!DOCTYPE html><html lang="fa"><body>پرداخت</body></html>';
    assert.equal(isPayableGatewayPage(200, html), true);
});

test('rejects the sandbox server-error page', () => {
    const html = '<!DOCTYPE html><html lang="en"><title>Server Error</title></html>';
    assert.equal(isPayableGatewayPage(500, html), false);
    assert.equal(isPayableGatewayPage(200, html), false);
});
