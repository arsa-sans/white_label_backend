/**
 * src/middlewares/errorHandler.middleware.ts
 * Global error handler — must be registered LAST in Express middleware chain.
 * Catches all errors forwarded via next(err) from route handlers and async wrappers.
 */
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiResponse } from '../utils/apiResponse';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Sequelize validation error shape
interface SequelizeError extends Error {
  name: string;
  errors?: Array<{ message: string }>;
  parent?: { code: string };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const seqErr = err as SequelizeError;

  // Sequelize unique constraint violation (e.g. duplicate idempotency_key)
  if (seqErr.name === 'SequelizeUniqueConstraintError') {
    res.status(409).json(ApiResponse.error('Duplicate entry — resource already exists', 409));
    return;
  }

  // Sequelize validation errors
  if (seqErr.name === 'SequelizeValidationError') {
    const messages = seqErr.errors?.map((e) => e.message).join(', ') ?? 'Validation error';
    res.status(400).json(ApiResponse.error(messages, 400));
    return;
  }

  // Operational errors (AppError)
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json(ApiResponse.error(err.message, err.statusCode));
    return;
  }

  // Unknown / programming errors — log, respond 500
  console.error('[ERROR]', {
    message: err.message,
    stack: env.isDev ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  res.status(500).json(
    ApiResponse.error(
      env.isDev ? err.message : 'An unexpected error occurred',
      500
    )
  );
}
