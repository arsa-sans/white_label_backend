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
const redisConfig = {
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
};
if (env_1.env.REDIS_PASSWORD) {
    redisConfig.password = env_1.env.REDIS_PASSWORD;
}
exports.redis = new ioredis_1.default(redisConfig);
exports.redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});
async function connectRedis() {
    await exports.redis.connect();
    console.log('[Redis] Connected');
}
/**
 * Distributed lock helper (Redlock-lite pattern).
 * Returns true if lock acquired, false if already locked by someone else.
 *
 * SKILLS.md § Skill 1: seat:{seat_id} lock TTL 5 min (300000ms)
 */
async function acquireLock(key, value, ttlMs) {
    const result = await exports.redis.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
}
/**
 * Release lock only if current holder matches (prevents releasing someone else's lock)
 */
async function releaseLock(key, value) {
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
//# sourceMappingURL=redis.js.map