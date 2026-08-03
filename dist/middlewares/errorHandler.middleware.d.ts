/**
 * src/middlewares/errorHandler.middleware.ts
 * Global error handler — must be registered LAST in Express middleware chain.
 * Catches all errors forwarded via next(err) from route handlers and async wrappers.
 */
import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
}
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.middleware.d.ts.map