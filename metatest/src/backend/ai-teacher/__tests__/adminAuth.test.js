'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyAdminPassword, looksLikeMd5, md5Hex } = require('../../utils/password');

test('scrypt hash round-trips', async () => {
    const hashed = await hashPassword('correct horse');
    const ok = await verifyAdminPassword({ username: 'x', password: hashed }, 'correct horse');
    const no = await verifyAdminPassword({ username: 'x', password: hashed }, 'wrong');
    assert.equal(ok.ok, true);
    assert.equal(ok.upgrade, false);
    assert.equal(no.ok, false);
});

test('legacy md5 hashes verify and request upgrade', async () => {
    const stored = md5Hex('secret123');
    assert.equal(looksLikeMd5(stored), true);
    const ok = await verifyAdminPassword({ username: 'bob', password: stored }, 'secret123');
    const no = await verifyAdminPassword({ username: 'bob', password: stored }, 'nope');
    assert.equal(ok.ok, true);
    assert.equal(ok.upgrade, true);
    assert.equal(no.ok, false);
});

test('legacy Admin@N password for adminN usernames upgrades', async () => {
    const ok = await verifyAdminPassword({ username: 'admin3', password: 'not-a-real-hash' }, 'Admin@3');
    const no = await verifyAdminPassword({ username: 'admin3', password: 'not-a-real-hash' }, 'Admin@4');
    assert.equal(ok.ok, true);
    assert.equal(ok.upgrade, true);
    assert.equal(no.ok, false);
});
