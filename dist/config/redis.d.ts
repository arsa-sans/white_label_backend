/**
 * src/config/redis.ts
 * ioredis client — shared singleton.
 * Used for: distributed seat locks, idempotency key store,
 * tenant config cache, gate offline cache, virtual queue sorted sets.
 */
import Redis from 'ioredis';
export declare const redis: Redis;
export declare function connectRedis(): Promise<void>;
/**
 * Distributed lock helper (Redlock-lite pattern).
 * Returns true if lock acquired, false if already locked by someone else.
 *
 * SKILLS.md § Skill 1: seat:{seat_id} lock TTL 5 min (300000ms)
 */
export declare function acquireLock(key: string, value: string, ttlMs: number): Promise<boolean>;
/**
 * Release lock only if current holder matches (prevents releasing someone else's lock)
 */
export declare function releaseLock(key: string, value: string): Promise<boolean>;
//# sourceMappingURL=redis.d.ts.map