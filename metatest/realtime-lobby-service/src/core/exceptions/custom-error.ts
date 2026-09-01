export class CustomError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: unknown;

    constructor(message: string, statusCode = 400, code = 'CUSTOM_ERROR', details?: unknown) {
        super(message);
        this.name = 'CustomError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
