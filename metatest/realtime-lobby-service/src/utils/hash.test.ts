import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeQuizId, encodeQuizId, decodeResultId, encodeResultId } from './hash';

describe('hash ids', () => {
    it('round-trips quiz ids', () => {
        const encoded = encodeQuizId(81);
        assert.ok(encoded);
        assert.equal(decodeQuizId(encoded), 81);
    });

    it('rejects invalid quiz ids', () => {
        assert.equal(encodeQuizId(0), null);
        assert.equal(decodeQuizId('not-a-hash'), null);
    });

    it('round-trips result ids', () => {
        const encoded = encodeResultId(42);
        assert.ok(encoded);
        assert.equal(decodeResultId(encoded), 42);
    });
});
