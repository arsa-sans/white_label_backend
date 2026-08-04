/**
 * src/config/redis.ts
 * ioredis client — shared singleton.
 * Used for: distributed seat locks, idempotency key store,
 * tenant config cache, gate offline cache, virtual queue sorted sets.
 */
import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times: number) {
    const maxRetries = env.isDev ? 1 : 3;
    if (times > maxRetries) {
      return null; // Stop retrying
    }
    return Math.min(times * 200, 1000);
  },
};

if (env.REDIS_PASSWORD) {
  redisConfig.password = env.REDIS_PASSWORD;
}

export const redis = new Redis(redisConfig);

redis.on('error', (err: any) => {
  if (redis.status === 'end') return;
  // In development mode, suppress repeated ECONNREFUSED log noise
  if (env.isDev && (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED'))) {
    return;
  }
  logger.error('[Redis] Connection error:', err.message || err);
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('[Redis] Connected');
  } catch (err) {
    if (env.isDev) {
      logger.warn('[Redis] Connection failed (non-fatal in dev mode, running without Redis)');
    } else {
      logger.error('[Redis] Connection failed', (err as Error).message || err);
    }
  }
}

/**
 * Distributed lock helper (Redlock-lite pattern).
 * Returns true if lock acquired, false if already locked by someone else.
 *
 * SKILLS.md § Skill 1: seat:{seat_id} lock TTL 5 min (300000ms)
 */
export async function acquireLock(
  key: string,
  value: string,
  ttlMs: number
): Promise<boolean> {
  try {
    const result = await redis.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  } catch {
    return false;
  }
}

/**
 * Release lock only if current holder matches (prevents releasing someone else's lock)
 */
export async function releaseLock(key: string, value: string): Promise<boolean> {
  try {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await redis.eval(script, 1, key, value);
    return result === 1;
  } catch {
    return false;
  }
}
