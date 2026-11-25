'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireInternalService } = require('./internalAuth');

function run(req) {
    return new Promise((resolve) => {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { resolve({ status: this.statusCode, body }); },
        };
        requireInternalService(req, res, () => resolve({ status: 200, body: null }));
    });
}

const local = { socket: { remoteAddress: '127.0.0.1' }, get: () => undefined };

test('SEC-037 public address is refused even with the key', async () => {
    process.env.INTERNAL_SERVICE_KEY = 'a'.repeat(24);
    const result = await run({
        socket: { remoteAddress: '203.0.113.5' },
        get: () => process.env.INTERNAL_SERVICE_KEY,
    });
    assert.equal(result.status, 403);
});

test('SEC-037 loopback without the key is refused', async () => {
    process.env.INTERNAL_SERVICE_KEY = 'b'.repeat(24);
    const result = await run(local);
    assert.equal(result.status, 401);
});

test('SEC-037 loopback with the env key is allowed', async () => {
    process.env.INTERNAL_SERVICE_KEY = 'c'.repeat(24);
    const result = await run({
        socket: { remoteAddress: '::ffff:127.0.0.1' },
        get: (name) => (String(name).toLowerCase() === 'x-internal-service-key' ? process.env.INTERNAL_SERVICE_KEY : undefined),
    });
    assert.equal(result.status, 200);
});

test('SEC-015 a short key is refused', async () => {
    process.env.INTERNAL_SERVICE_KEY = 'short-key';
    const result = await run({
        socket: { remoteAddress: '127.0.0.1' },
        get: () => 'short-key',
    });
    assert.equal(result.status, 401);
});
