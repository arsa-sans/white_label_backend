"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireIdempotency = requireIdempotency;
exports.cacheIdempotentResponse = cacheIdempotentResponse;
exports.checkIdempotencyCache = checkIdempotencyCache;
const redis_1 = require("../config/redis");
const apiResponse_1 = require("../utils/apiResponse");
const IDEMPOTENCY_TTL = 86400; // 24 hours — enough for all practical retry windows
function requireIdempotency(req, res, next) {
    const key = req.headers['idempotency-key'];
    if (!key || key.trim() === '') {
        res.status(400).json(apiResponse_1.ApiResponse.error('Idempotency-Key header is required for this endpoint', 400));
        return;
    }
    // Attach to req for use in controllers when storing the key
    req.idempotencyKey = key.trim();
    next();
}
/**
 * Cache idempotent response in Redis.
 * Call this AFTER processing in the controller, before returning response.
 */
async function cacheIdempotentResponse(idempotencyKey, userId, statusCode, body) {
    try {
        const cacheKey = `idempotency:${userId}:${idempotencyKey}`;
        await redis_1.redis.setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify({ statusCode, body, cachedAt: new Date().toISOString() }));
    }
    catch {
        // Redis unavailable, ignore idempotency caching error
    }
}
/**
 * Check if an idempotency key was already processed.
 * Returns cached response if found, null otherwise.
 */
async function checkIdempotencyCache(idempotencyKey, userId) {
    try {
        const cacheKey = `idempotency:${userId}:${idempotencyKey}`;
        const cached = await redis_1.redis.get(cacheKey);
        if (!cached)
            return null;
        return JSON.parse(cached);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=idempotency.middleware.js.map