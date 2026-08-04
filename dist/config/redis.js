"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.connectRedis = connectRedis;
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
/**
 * src/config/redis.ts
 * ioredis client — shared singleton.
 * Used for: distributed seat locks, idempotency key store,
 * tenant config cache, gate offline cache, virtual queue sorted sets.
 */
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
const redisConfig = {
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
        const maxRetries = env_1.env.isDev ? 1 : 3;
        if (times > maxRetries) {
            return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
    },
};
if (env_1.env.REDIS_PASSWORD) {
    redisConfig.password = env_1.env.REDIS_PASSWORD;
}
exports.redis = new ioredis_1.default(redisConfig);
exports.redis.on('error', (err) => {
    if (exports.redis.status === 'end')
        return;
    // In development mode, suppress repeated ECONNREFUSED log noise
    if (env_1.env.isDev && (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED'))) {
        return;
    }
    logger_1.logger.error('[Redis] Connection error:', err.message || err);
});
async function connectRedis() {
    try {
        await exports.redis.connect();
        logger_1.logger.info('[Redis] Connected');
    }
    catch (err) {
        if (env_1.env.isDev) {
            logger_1.logger.warn('[Redis] Connection failed (non-fatal in dev mode, running without Redis)');
        }
        else {
            logger_1.logger.error('[Redis] Connection failed', err.message || err);
        }
    }
}
/**
 * Distributed lock helper (Redlock-lite pattern).
 * Returns true if lock acquired, false if already locked by someone else.
 *
 * SKILLS.md § Skill 1: seat:{seat_id} lock TTL 5 min (300000ms)
 */
async function acquireLock(key, value, ttlMs) {
    try {
        const result = await exports.redis.set(key, value, 'PX', ttlMs, 'NX');
        return result === 'OK';
    }
    catch {
        return false;
    }
}
/**
 * Release lock only if current holder matches (prevents releasing someone else's lock)
 */
async function releaseLock(key, value) {
    try {
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
        const result = await exports.redis.eval(script, 1, key, value);
        return result === 1;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=redis.js.map