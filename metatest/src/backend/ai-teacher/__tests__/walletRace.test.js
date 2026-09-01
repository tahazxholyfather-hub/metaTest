'use strict';

/**
 * Lightweight race-condition simulation for reservation logic.
 * Uses an in-memory wallet stand-in (no MySQL required).
 */

const assert = require('assert');

function createMemoryWallet(initial = 20) {
    let balance = initial;
    let lock = Promise.resolve();

    const withLock = (fn) => {
        const run = lock.then(fn, fn);
        lock = run.catch(() => {});
        return run;
    };

    return {
        getBalance: () => balance,
        reserve: (amount) =>
            withLock(async () => {
                if (balance < 1) {
                    const err = new Error('INSUFFICIENT_COINS');
                    err.code = 'INSUFFICIENT_COINS';
                    throw err;
                }
                const reserved = Math.min(balance, amount);
                balance -= reserved;
                return reserved;
            }),
        refund: (amount) =>
            withLock(async () => {
                balance += amount;
            }),
    };
}

async function main() {
    const wallet = createMemoryWallet(20);

    const results = await Promise.allSettled([
        wallet.reserve(20),
        wallet.reserve(20),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'only one reservation should succeed fully from 20 coins');
    assert.ok(rejected.length === 1 || wallet.getBalance() === 0, 'second request must fail or see empty wallet');
    assert.ok(wallet.getBalance() >= 0, 'balance never negative');

    console.log('✓ concurrent reservations do not double-spend');
}

main().catch((err) => {
    console.error('✗ wallet race test failed', err);
    process.exit(1);
});
