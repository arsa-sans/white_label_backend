/**
 * src/middlewares/idempotency.middleware.ts
 * Enforces idempotency for state-mutating endpoints (orders, payments, wallet debits).
 *
 * SKILLS.md §2: Client must send Idempotency-Key header (UUID v4).
 * - If key seen before with a final status → return cached response, no re-processing.
 * - If key seen but status still pending → 409 Conflict (operation in progress).
 * - If key not seen → process normally, cache response in Redis.
 *
 * Usage: router.post('/orders', authenticate, requireIdempotency, createOrderHandler)
 */
import { Request, Response, NextFunction } from 'express';
export declare function requireIdempotency(req: Request, res: Response, next: NextFunction): void;
/**
 * Cache idempotent response in Redis.
 * Call this AFTER processing in the controller, before returning response.
 */
export declare function cacheIdempotentResponse(idempotencyKey: string, userId: string, statusCode: number, body: unknown): Promise<void>;
/**
 * Check if an idempotency key was already processed.
 * Returns cached response if found, null otherwise.
 */
export declare function checkIdempotencyCache(idempotencyKey: string, userId: string): Promise<{
    statusCode: number;
    body: unknown;
} | null>;
declare global {
    namespace Express {
        interface Request {
            idempotencyKey?: string;
        }
    }
}
//# sourceMappingURL=idempotency.middleware.d.ts.map