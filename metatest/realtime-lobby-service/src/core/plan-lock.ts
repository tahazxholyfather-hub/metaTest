import { CustomError } from './exceptions/custom-error';

export const MULTIPLAYER_LOCKED_CODE = 'MULTIPLAYER_LOCKED';

const DEFAULT_MULTIPLAYER_LOCKED_MESSAGE =
    'ورود به آزمون آنلاین با اشتراک ویژه ممکن است.';

export function extractBackendErrorCode(responseBody: unknown): string | undefined {
    if (!responseBody || typeof responseBody !== 'object') {
        return undefined;
    }

    const body = responseBody as {
        code?: unknown;
        error?: { code?: unknown };
    };

    if (typeof body.code === 'string' && body.code.trim()) {
        return body.code.trim();
    }

    if (typeof body.error?.code === 'string' && body.error.code.trim()) {
        return body.error.code.trim();
    }

    return undefined;
}

export function mainBackendHttpError(
    message: string,
    status: number,
    responseBody: unknown,
): CustomError {
    const code = extractBackendErrorCode(responseBody);
    return new CustomError(
        message,
        status >= 500 ? 502 : status,
        code || 'MAIN_BACKEND_REQUEST_FAILED',
        {
            status,
            ...(code ? { code } : {}),
        },
    );
}

export function isMultiplayerLocked(err: CustomError): boolean {
    if (err.code === MULTIPLAYER_LOCKED_CODE) {
        return true;
    }

    if (err.details && typeof err.details === 'object' && 'code' in err.details) {
        return (err.details as { code?: unknown }).code === MULTIPLAYER_LOCKED_CODE;
    }

    return false;
}

export function rethrowJoinDenied(err: unknown): never {
    if (err instanceof CustomError && isMultiplayerLocked(err)) {
        throw new CustomError(
            err.message || DEFAULT_MULTIPLAYER_LOCKED_MESSAGE,
            403,
            MULTIPLAYER_LOCKED_CODE,
            err.details,
        );
    }

    throw err;
}
