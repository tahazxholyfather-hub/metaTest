import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryLockManager } from './lock';

describe('MemoryLockManager', () => {
    it('runs critical sections for the same key in order', async () => {
        const locks = new MemoryLockManager();
        const order: number[] = [];

        await Promise.all([
            locks.withLock('lobby:abc', async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                order.push(1);
            }),
            locks.withLock('lobby:abc', async () => {
                order.push(2);
            }),
        ]);

        assert.deepEqual(order, [1, 2]);
    });

    it('does not block different keys', async () => {
        const locks = new MemoryLockManager();
        const started: string[] = [];

        const first = locks.withLock('a', async () => {
            started.push('a');
            await new Promise((resolve) => setTimeout(resolve, 30));
        });
        const second = locks.withLock('b', async () => {
            started.push('b');
        });

        await Promise.all([first, second]);
        assert.equal(started.includes('a'), true);
        assert.equal(started.includes('b'), true);
    });
});
