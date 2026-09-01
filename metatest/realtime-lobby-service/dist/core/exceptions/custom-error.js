"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomError = void 0;
class CustomError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 400, code = 'CUSTOM_ERROR', details) {
        super(message);
        this.name = 'CustomError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
exports.CustomError = CustomError;
