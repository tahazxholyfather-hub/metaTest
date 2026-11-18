'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { inviteUrlForCode } = require('../referralUrl');

test('local invite links stay on the dev app', () => {
    const url = inviteUrlForCode('MT12AB', { FRONTEND_URL: 'http://localhost:5173/' }, true);
    assert.equal(url, 'http://localhost:5173/invite/MT12AB');
});

test('hosted invite links include the /app mount', () => {
    const url = inviteUrlForCode('MT12AB', { FRONTEND_URL: 'https://metatest.app' }, false);
    assert.equal(url, 'https://metatest.app/app/invite/MT12AB');
});

test('a leftover localhost FRONTEND_URL does not leak into production links', () => {
    const url = inviteUrlForCode('MT9FF', { FRONTEND_URL: 'http://localhost:5173' }, false);
    assert.equal(url, 'https://metatest.app/app/invite/MT9FF');
});

test('an origin that already ends in /app is not doubled', () => {
    const url = inviteUrlForCode('MT1', { FRONTEND_URL: 'https://metatest.app/app/' }, false);
    assert.equal(url, 'https://metatest.app/app/invite/MT1');
});
