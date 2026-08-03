"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
const env_1 = require("../config/env");
const apiResponse_1 = require("../utils/apiResponse");
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, _next) {
    const seqErr = err;
    // Sequelize unique constraint violation (e.g. duplicate idempotency_key)
    if (seqErr.name === 'SequelizeUniqueConstraintError') {
        res.status(409).json(apiResponse_1.ApiResponse.error('Duplicate entry — resource already exists', 409));
        return;
    }
    // Sequelize validation errors
    if (seqErr.name === 'SequelizeValidationError') {
        const messages = seqErr.errors?.map((e) => e.message).join(', ') ?? 'Validation error';
        res.status(400).json(apiResponse_1.ApiResponse.error(messages, 400));
        return;
    }
    // Operational errors (AppError)
    if (err instanceof AppError && err.isOperational) {
        res.status(err.statusCode).json(apiResponse_1.ApiResponse.error(err.message, err.statusCode));
        return;
    }
    // Unknown / programming errors — log, respond 500
    console.error('[ERROR]', {
        message: err.message,
        stack: env_1.env.isDev ? err.stack : undefined,
        url: req.url,
        method: req.method,
    });
    res.status(500).json(apiResponse_1.ApiResponse.error(env_1.env.isDev ? err.message : 'An unexpected error occurred', 500));
}
//# sourceMappingURL=errorHandler.middleware.js.map