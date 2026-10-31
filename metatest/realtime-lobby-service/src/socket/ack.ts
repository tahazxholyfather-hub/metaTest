import { CustomError } from '../core/exceptions/custom-error';
import { logger } from '../config/logger';
import { env } from '../config/env';

export type SocketAckFn = ((response: unknown) => void) | undefined;

export function ackSuccess(cb: SocketAckFn, data?: unknown): void {
    cb?.({
        ok: true,
        success: true,
        data,
    });
}

export function ackError(cb: SocketAckFn, err: unknown): void {
    if (err instanceof CustomError) {
        cb?.({
            ok: false,
            success: false,
            message: err.message,
            code: err.code,
            statusCode: err.statusCode,
            error: {
                message: err.message,
                code: err.code,
                statusCode: err.statusCode,
                details: err.details ?? null,
            },
        });
        return;
    }

    const message =
        err instanceof Error && env.NODE_ENV !== 'production'
            ? err.message
            : 'Internal server error';

    logger.error({ err }, 'Unhandled socket handler error');

    cb?.({
        ok: false,
        success: false,
        message,
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        error: {
            message,
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: 500,
        },
    });
}
