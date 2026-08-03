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
import { redis } from '../config/redis';
import { ApiResponse } from '../utils/apiResponse';

const IDEMPOTENCY_TTL = 86400; // 24 hours — enough for all practical retry windows

export function requireIdempotency(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.headers['idempotency-key'] as string | undefined;

  if (!key || key.trim() === '') {
    res.status(400).json(
      ApiResponse.error('Idempotency-Key header is required for this endpoint', 400)
    );
    return;
  }

  // Attach to req for use in controllers when storing the key
  (req as Request & { idempotencyKey: string }).idempotencyKey = key.trim();
  next();
}

/**
 * Cache idempotent response in Redis.
 * Call this AFTER processing in the controller, before returning response.
 */
export async function cacheIdempotentResponse(
  idempotencyKey: string,
  userId: string,
  statusCode: number,
  body: unknown
): Promise<void> {
  const cacheKey = `idempotency:${userId}:${idempotencyKey}`;
  await redis.setex(
    cacheKey,
    IDEMPOTENCY_TTL,
    JSON.stringify({ statusCode, body, cachedAt: new Date().toISOString() })
  );
}

/**
 * Check if an idempotency key was already processed.
 * Returns cached response if found, null otherwise.
 */
export async function checkIdempotencyCache(
  idempotencyKey: string,
  userId: string
): Promise<{ statusCode: number; body: unknown } | null> {
  const cacheKey = `idempotency:${userId}:${idempotencyKey}`;
  const cached = await redis.get(cacheKey);
  if (!cached) return null;
  return JSON.parse(cached) as { statusCode: number; body: unknown };
}

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}
