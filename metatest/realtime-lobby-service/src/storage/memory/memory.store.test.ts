import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryStore } from './memory.store';

describe('MemoryStore', () => {
    it('normalizes numeric and string user ids', async () => {
        const store = new MemoryStore();
        await store.createLobby({
            code: 'ABC123',
            quizId: 1,
            hostUserId: '1',
            status: 'waiting',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            questionCount: 5,
            maxMembers: 10,
            joinLocked: false,
            seq: 1,
        });

        await store.setMember('ABC123', {
            userId: '1',
            username: 'host',
            trophies: 0,
            isReady: true,
            isHost: true,
            joinedAt: Date.now(),
            connected: true,
            socketId: 'sock-1',
        });

        const byNumber = await store.getMember('ABC123', 1);
        const byString = await store.getMember('ABC123', '1');
        assert.equal(byNumber?.username, 'host');
        assert.equal(byString?.username, 'host');
    });

    it('does not treat disconnected members as expired until expiry is scheduled', async () => {
        const store = new MemoryStore();
        await store.createLobby({
            code: 'XYZ999',
            quizId: 2,
            hostUserId: '9',
            status: 'waiting',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            questionCount: 5,
            maxMembers: 10,
            joinLocked: false,
            seq: 1,
        });

        await store.setMember('XYZ999', {
            userId: '9',
            username: 'host',
            trophies: 0,
            isReady: true,
            isHost: true,
            joinedAt: Date.now(),
            connected: false,
        });

        const expired = await store.listExpiredLobbyCodes(Date.now());
        assert.deepEqual(expired, []);
    });

    it('lists expired lobby codes', async () => {
        const store = new MemoryStore();
        await store.createLobby({
            code: 'OLD001',
            quizId: 3,
            hostUserId: '3',
            status: 'results',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            questionCount: 5,
            maxMembers: 10,
            joinLocked: true,
            seq: 4,
        });
        await store.scheduleLobbyExpiry('OLD001', Date.now() - 1);
        const expired = await store.listExpiredLobbyCodes(Date.now());
        assert.deepEqual(expired, ['OLD001']);
    });
});
