import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { CustomError } from '../../core/exceptions/custom-error';
import { logger } from '../../config/logger';

export function errorMiddleware(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    if (err instanceof CustomError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
            details: err.details ?? null,
        });
    }

    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: err.flatten(),
        });
    }

    logger.error({ err }, 'Unhandled API error');

    return res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
    });
}
