"use strict";
/**
 * src/modules/ticket/queue.controller.ts
 *
 * FASE 6 — Virtual Waiting Room (Queue Management)
 *
 * Implementasi mengikuti SKILLS.md § Skill 5 (Virtual Waiting Room):
 *   1. joinQueue   → ZADD queue:{event_id} {timestamp} {session_id} di Redis / in-memory fallback
 *   2. getQueueStatus → ZRANK queue:{event_id} {session_id} → hitung posisi antrean & estimasi tunggu
 *   3. admitQueue  → admit batch user teratas (set session admitted TTL 10 menit di Redis)
 *                    + broadcast update via Socket.IO ke room event
 *   4. checkAdmitted → helper/middleware untuk validasi apakah user sudah di-admit sebelum boleh hit lockSeat
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinQueue = joinQueue;
exports.getQueueStatus = getQueueStatus;
exports.admitQueue = admitQueue;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../../config/redis");
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
const server_1 = require("../../server");
const logger_1 = require("../../utils/logger");
const ADMITTED_TTL_MS = 10 * 60 * 1000; // 10 minutes session TTL
class InMemQueue {
    constructor() {
        this.queues = new Map(); // eventId -> entries sorted by timestamp
        this.admitted = new Map(); // sessionId -> entry
    }
    join(eventId, userId) {
        let list = this.queues.get(eventId) || [];
        // Check if already admitted
        const existingAdmitted = Array.from(this.admitted.values()).find((e) => e.eventId === eventId && e.userId === userId && e.admittedAt + ADMITTED_TTL_MS > Date.now());
        if (existingAdmitted) {
            return { sessionId: existingAdmitted.sessionId, rank: 0, admitted: true };
        }
        // Check if already in queue
        const existing = list.find((e) => e.userId === userId);
        if (existing) {
            const rank = list.findIndex((e) => e.userId === userId) + 1;
            return { sessionId: existing.sessionId, rank, admitted: false };
        }
        const sessionId = `sess-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
        const entry = { sessionId, userId, eventId, timestamp: Date.now() };
        list.push(entry);
        this.queues.set(eventId, list);
        return { sessionId, rank: list.length, admitted: false };
    }
    getStatus(eventId, sessionId) {
        const adm = this.admitted.get(sessionId);
        if (adm && adm.admittedAt + ADMITTED_TTL_MS > Date.now()) {
            return { rank: 0, total: 0, admitted: true };
        }
        const list = this.queues.get(eventId) || [];
        const index = list.findIndex((e) => e.sessionId === sessionId);
        if (index === -1) {
            return { rank: -1, total: list.length, admitted: false };
        }
        return { rank: index + 1, total: list.length, admitted: false };
    }
    admit(eventId, count) {
        const list = this.queues.get(eventId) || [];
        const toAdmit = list.splice(0, count);
        let admittedCount = 0;
        for (const item of toAdmit) {
            item.admittedAt = Date.now();
            this.admitted.set(item.sessionId, item);
            admittedCount++;
        }
        this.queues.set(eventId, list);
        return admittedCount;
    }
}
const inMemQueue = new InMemQueue();
function isRedisReady() {
    return redis_1.redis.status === 'ready';
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /tickets/queue/join
// Body: { event_id }
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function joinQueue(req, res) {
    const { event_id } = req.body;
    const userId = req.user?.userId;
    if (!event_id) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id is required', 400));
        return;
    }
    const event = dataStore_1.dataStore.events.find((e) => e.id === event_id);
    if (!event) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Event not found', 404));
        return;
    }
    const timestamp = Date.now();
    const sessionId = `sess-${userId}-${event_id}`;
    if (isRedisReady()) {
        try {
            const admittedKey = `queue:admitted:${event_id}:${sessionId}`;
            const isAdmitted = await redis_1.redis.get(admittedKey);
            if (isAdmitted) {
                res.json(apiResponse_1.ApiResponse.success({
                    session_id: sessionId,
                    event_id,
                    rank: 0,
                    admitted: true,
                    expires_in_seconds: 600,
                }, 'You are already admitted to checkout'));
                return;
            }
            // Add to ZSET queue
            const queueKey = `queue:${event_id}`;
            await redis_1.redis.zadd(queueKey, timestamp, sessionId);
            const rank = (await redis_1.redis.zrank(queueKey, sessionId)) ?? 0;
            res.json(apiResponse_1.ApiResponse.success({
                session_id: sessionId,
                event_id,
                rank: rank + 1,
                admitted: false,
                estimated_wait_seconds: (rank + 1) * 3,
            }, 'Joined virtual queue successfully'));
            return;
        }
        catch (err) {
            logger_1.logger.warn('[Queue] Redis error, falling back to in-memory queue', err);
        }
    }
    // Fallback to in-memory queue
    const resData = inMemQueue.join(event_id, userId);
    res.json(apiResponse_1.ApiResponse.success({
        session_id: resData.sessionId,
        event_id,
        rank: resData.rank,
        admitted: resData.admitted,
        estimated_wait_seconds: resData.rank * 3,
    }, resData.admitted ? 'Admitted to checkout' : 'Joined virtual queue successfully'));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/queue/status
// Query: event_id, session_id
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function getQueueStatus(req, res) {
    const event_id = req.query.event_id;
    const session_id = req.query.session_id || `sess-${req.user?.userId}-${event_id}`;
    if (!event_id) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id is required', 400));
        return;
    }
    if (isRedisReady()) {
        try {
            const admittedKey = `queue:admitted:${event_id}:${session_id}`;
            const isAdmitted = await redis_1.redis.get(admittedKey);
            if (isAdmitted) {
                const ttl = await redis_1.redis.ttl(admittedKey);
                res.json(apiResponse_1.ApiResponse.success({
                    session_id,
                    event_id,
                    rank: 0,
                    admitted: true,
                    expires_in_seconds: ttl > 0 ? ttl : 600,
                }, 'User is admitted'));
                return;
            }
            const queueKey = `queue:${event_id}`;
            const rank = await redis_1.redis.zrank(queueKey, session_id);
            const total = await redis_1.redis.zcard(queueKey);
            if (rank === null) {
                res.json(apiResponse_1.ApiResponse.success({
                    session_id,
                    event_id,
                    rank: -1,
                    total,
                    admitted: false,
                }, 'Session not found in queue'));
                return;
            }
            res.json(apiResponse_1.ApiResponse.success({
                session_id,
                event_id,
                rank: rank + 1,
                total,
                admitted: false,
                estimated_wait_seconds: (rank + 1) * 3,
            }, 'Queue status retrieved'));
            return;
        }
        catch (err) {
            logger_1.logger.warn('[Queue] Redis getQueueStatus fallback to in-memory', err);
        }
    }
    const status = inMemQueue.getStatus(event_id, session_id);
    res.json(apiResponse_1.ApiResponse.success({
        session_id,
        event_id,
        rank: status.rank,
        total: status.total,
        admitted: status.admitted,
        estimated_wait_seconds: Math.max(status.rank, 0) * 3,
    }, 'Queue status retrieved'));
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /tickets/queue/admit
// Body: { event_id, count? }
// Auth: requireRole(['organizer', 'admin'])
// ─────────────────────────────────────────────────────────────────────────────
async function admitQueue(req, res) {
    const { event_id, count = 50 } = req.body;
    if (!event_id) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id is required', 400));
        return;
    }
    let admittedCount = 0;
    if (isRedisReady()) {
        try {
            const queueKey = `queue:${event_id}`;
            const sessions = await redis_1.redis.zrange(queueKey, 0, count - 1);
            if (sessions.length > 0) {
                for (const sess of sessions) {
                    const admittedKey = `queue:admitted:${event_id}:${sess}`;
                    await redis_1.redis.setex(admittedKey, 600, 'true'); // 10 mins TTL
                    await redis_1.redis.zrem(queueKey, sess);
                    admittedCount++;
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('[Queue] Redis admit failed', err);
        }
    }
    else {
        admittedCount = inMemQueue.admit(event_id, count);
    }
    // Broadcast admission update via Socket.IO
    server_1.io.to(`event:${event_id}`).emit('queue_admitted', {
        event_id,
        admitted_count: admittedCount,
        timestamp: new Date().toISOString(),
    });
    res.json(apiResponse_1.ApiResponse.success({
        event_id,
        admitted_count: admittedCount,
    }, `Admitted ${admittedCount} user(s) to checkout`));
}
//# sourceMappingURL=queue.controller.js.map