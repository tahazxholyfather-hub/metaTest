"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
const zod_1 = require("zod");
const custom_error_1 = require("../../core/exceptions/custom-error");
const logger_1 = require("../../config/logger");
function errorMiddleware(err, _req, res, _next) {
    if (err instanceof custom_error_1.CustomError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
            details: err.details ?? null,
        });
    }
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: err.flatten(),
        });
    }
    logger_1.logger.error({ err }, 'Unhandled API error');
    return res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
    });
}
