import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CustomError } from './exceptions/custom-error';
import {
    extractBackendErrorCode,
    isMultiplayerLocked,
    mainBackendHttpError,
    MULTIPLAYER_LOCKED_CODE,
    rethrowJoinDenied,
} from './plan-lock';

describe('plan lock errors', () => {
    it('reads MULTIPLAYER_LOCKED from the quizWorldController 403 body', () => {
        assert.equal(
            extractBackendErrorCode({
                success: false,
                code: 'MULTIPLAYER_LOCKED',
                message: 'ورود به آزمون آنلاین با اشتراک ویژه ممکن است.',
            }),
            MULTIPLAYER_LOCKED_CODE,
        );
    });

    it('keeps MULTIPLAYER_LOCKED on the socket-facing CustomError', () => {
        const err = mainBackendHttpError(
            'ورود به آزمون آنلاین با اشتراک ویژه ممکن است.',
            403,
            {
                success: false,
                code: 'MULTIPLAYER_LOCKED',
                message: 'ورود به آزمون آنلاین با اشتراک ویژه ممکن است.',
            },
        );

        assert.equal(err.statusCode, 403);
        assert.equal(err.code, MULTIPLAYER_LOCKED_CODE);
        assert.equal(isMultiplayerLocked(err), true);

        try {
            rethrowJoinDenied(err);
            assert.fail('expected rethrowJoinDenied to throw');
        } catch (thrown) {
            assert.ok(thrown instanceof CustomError);
            assert.equal(thrown.code, MULTIPLAYER_LOCKED_CODE);
            assert.equal(thrown.statusCode, 403);
        }
    });

    it('does not remap unrelated backend failures', () => {
        const err = new CustomError('Lobby is full', 409, 'LOBBY_FULL');
        try {
            rethrowJoinDenied(err);
            assert.fail('expected rethrowJoinDenied to throw');
        } catch (thrown) {
            assert.equal(thrown, err);
        }
    });
});
