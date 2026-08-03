/**
 * src/config/redis.ts
 * ioredis client — shared singleton.
 * Used for: distributed seat locks, idempotency key store,
 * tenant config cache, gate offline cache, virtual queue sorted sets.
 */
import Redis from 'ioredis';
import { env } from './env';

const redisConfig: {
  host: string;
  port: number;
  password?: string;
  lazyConnect: boolean;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
} = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
};

if (env.REDIS_PASSWORD) {
  redisConfig.password = env.REDIS_PASSWORD;
}

export const redis = new Redis(redisConfig);

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

export async function connectRedis(): Promise<void> {
  await redis.connect();
  console.log('[Redis] Connected');
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
  const result = await redis.set(key, value, 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Release lock only if current holder matches (prevents releasing someone else's lock)
 */
export async function releaseLock(key: string, value: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, key, value);
  return result === 1;
}
