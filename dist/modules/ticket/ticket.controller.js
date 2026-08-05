"use strict";
/**
 * src/modules/ticket/ticket.controller.ts
 *
 * FASE 4 — Ticket Service (Seat Locking)
 *
 * Implementasi mengikuti SKILLS.md § Skill 1 (Redis Distributed Locking):
 *   1. lockSeat   → SET seat:lock:{seat_id} {userId} NX PX 300000 (5 min TTL)
 *                   + defense-in-depth check di dataStore (menggantikan SELECT FOR UPDATE di dev mode)
 *                   + broadcast Socket.IO `seat_locked` ke room event
 *   2. releaseSeat → releaseLock Redis (Lua CAS, only release if owner) + update DB status
 *                    + broadcast Socket.IO `seat_released`
 *   3. getDynamicQrToken → HMAC-SHA256 per time-window 30 detik (server-side, key tidak pernah ke client)
 *   4. getMyTickets      → enrich dengan detail event
 *   5. sweepExpiredSeats → cron sweeper, dipanggil dari scheduler
 *
 * Fallback dev mode: jika Redis tidak tersedia (ECONNREFUSED), operasi lock jatuh ke in-memory
 * dataStore saja agar developer bisa kerja tanpa infra Redis berjalan.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockSeat = lockSeat;
exports.releaseSeat = releaseSeat;
exports.getMyTickets = getMyTickets;
exports.getDynamicQrToken = getDynamicQrToken;
exports.sweepExpiredSeats = sweepExpiredSeats;
const crypto_1 = __importDefault(require("crypto"));
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
const redis_1 = require("../../config/redis");
const publisher_1 = require("../../queue/publisher");
const server_1 = require("../../server");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
// ─── Constants ──────────────────────────────────────────────────────────────
const SEAT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes per spec
const SEAT_LOCK_TTL_SEC = SEAT_LOCK_TTL_MS / 1000;
const QR_WINDOW_SEC = 30;
function seatLockKey(seatId) {
    return `seat:lock:${seatId}`;
}
// ─── Helper: check if Redis is reachable ────────────────────────────────────
function isRedisReady() {
    return redis_1.redis.status === 'ready';
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /tickets/lock-seat
// Body: { event_id, seat_id }
// Auth: authenticate (any logged-in user)
// ─────────────────────────────────────────────────────────────────────────────
async function lockSeat(req, res) {
    const { event_id, seat_id } = req.body;
    const userId = req.user?.userId;
    if (!event_id || !seat_id) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id and seat_id are required', 400));
        return;
    }
    if (!userId) {
        res.status(401).json(apiResponse_1.ApiResponse.error('Authentication required', 401));
        return;
    }
    // ── 1. Locate seat in dataStore (defense-in-depth row-level check) ──────
    const seat = dataStore_1.dataStore.seats.find((s) => s.id === seat_id && s.event_id === event_id);
    if (!seat) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Seat not found', 404));
        return;
    }
    const now = Date.now();
    if (seat.status === 'sold') {
        res.status(409).json(apiResponse_1.ApiResponse.error('Seat is already sold', 409));
        return;
    }
    // If locked by another user and TTL still valid → reject
    if (seat.status === 'locked' &&
        seat.locked_until &&
        new Date(seat.locked_until).getTime() > now &&
        seat.locked_by_user_id !== userId) {
        res.status(409).json(apiResponse_1.ApiResponse.error('Seat is currently locked by another user. Try again in a few minutes.', 409));
        return;
    }
    // ── 2. Attempt Redis distributed lock (NX PX) ──────────────────────────
    const lockKey = seatLockKey(seat_id);
    let redisLockAcquired = false;
    if (isRedisReady()) {
        // Check if this seat is already locked by another user in Redis
        const currentOwner = await redis_1.redis.get(lockKey).catch(() => null);
        if (currentOwner && currentOwner !== userId) {
            res.status(409).json(apiResponse_1.ApiResponse.error('Seat is currently locked by another user (Redis). Try again shortly.', 409));
            return;
        }
        redisLockAcquired = await (0, redis_1.acquireLock)(lockKey, userId, SEAT_LOCK_TTL_MS);
        if (!redisLockAcquired) {
            // acquireLock returns false if key exists with different value — already handled above, but double-safe
            res.status(409).json(apiResponse_1.ApiResponse.error('Seat lock conflict. Another user may have just locked this seat.', 409));
            return;
        }
        logger_1.logger.debug(`[Ticket] Redis lock acquired: ${lockKey} by ${userId}`);
    }
    else {
        logger_1.logger.warn('[Ticket] Redis unavailable — falling back to in-memory lock only (dev mode)');
    }
    // ── 3. Update dataStore (in-memory DB representation) ──────────────────
    const lockedUntil = new Date(now + SEAT_LOCK_TTL_MS).toISOString();
    seat.status = 'locked';
    seat.locked_until = lockedUntil;
    seat.locked_by_user_id = userId;
    // ── 4. Broadcast seat_locked to all clients viewing this event's seat map ─
    server_1.io.to(`event:${event_id}`).emit('seat_locked', {
        seat_id,
        event_id,
        locked_by: userId,
        locked_until: lockedUntil,
    });
    // ── 5. Publish domain event to RabbitMQ (for analytics/notification) ───
    (0, publisher_1.publishEvent)('seat.locked', { seat_id, event_id, user_id: userId, locked_until: lockedUntil }, req.user?.tenantId || 'tenant-001').catch((err) => logger_1.logger.warn('[Ticket] Failed to publish seat.locked event', err));
    res.json(apiResponse_1.ApiResponse.success({
        seat_id,
        event_id,
        status: 'locked',
        locked_until: lockedUntil,
        expires_in_seconds: SEAT_LOCK_TTL_SEC,
        redis_lock: redisLockAcquired,
    }, 'Seat locked successfully. You have 5 minutes to complete checkout.'));
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /tickets/release-seat
// Body: { event_id, seat_id }
// Auth: authenticate — only the seat owner (or admin/superadmin) can release
// ─────────────────────────────────────────────────────────────────────────────
async function releaseSeat(req, res) {
    const { event_id, seat_id } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!event_id || !seat_id) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id and seat_id are required', 400));
        return;
    }
    if (!userId) {
        res.status(401).json(apiResponse_1.ApiResponse.error('Authentication required', 401));
        return;
    }
    const seat = dataStore_1.dataStore.seats.find((s) => s.id === seat_id && s.event_id === event_id);
    if (!seat) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Seat not found', 404));
        return;
    }
    if (seat.status === 'sold') {
        res.status(409).json(apiResponse_1.ApiResponse.error('Cannot release a sold seat', 409));
        return;
    }
    if (seat.status === 'available') {
        // Already available — idempotent success
        res.json(apiResponse_1.ApiResponse.success({ seat_id, status: 'available' }, 'Seat is already available'));
        return;
    }
    // Authorization: only the lock owner or admin/superadmin may release
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    if (seat.locked_by_user_id !== userId && !isAdmin) {
        res.status(403).json(apiResponse_1.ApiResponse.error('You are not the owner of this seat lock', 403));
        return;
    }
    // ── 1. Release Redis lock (CAS Lua script — only deletes if value matches) ─
    const lockKey = seatLockKey(seat_id);
    if (isRedisReady()) {
        // Admin release: delete unconditionally; owner release: CAS delete
        if (isAdmin) {
            await redis_1.redis.del(lockKey).catch((err) => logger_1.logger.warn('[Ticket] Redis DEL failed during admin release', err));
        }
        else {
            const released = await (0, redis_1.releaseLock)(lockKey, userId);
            if (!released) {
                logger_1.logger.warn(`[Ticket] Redis releaseLock CAS mismatch for ${lockKey} — proceeding with DB update`);
            }
        }
    }
    // ── 2. Update dataStore ──────────────────────────────────────────────────
    seat.status = 'available';
    seat.locked_until = undefined;
    seat.locked_by_user_id = undefined;
    // ── 3. Broadcast to seat map viewers ────────────────────────────────────
    server_1.io.to(`event:${event_id}`).emit('seat_released', {
        seat_id,
        event_id,
    });
    // ── 4. Publish domain event ──────────────────────────────────────────────
    (0, publisher_1.publishEvent)('seat.released', { seat_id, event_id, user_id: userId, released_by: isAdmin ? 'admin' : 'owner' }, req.user?.tenantId || 'tenant-001').catch((err) => logger_1.logger.warn('[Ticket] Failed to publish seat.released event', err));
    logger_1.logger.info(`[Ticket] Seat ${seat_id} released by user ${userId} (admin=${isAdmin})`);
    res.json(apiResponse_1.ApiResponse.success({ seat_id, event_id, status: 'available' }, 'Seat released successfully'));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/my-tickets
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function getMyTickets(req, res) {
    const userId = req.user?.userId;
    const userTickets = dataStore_1.dataStore.tickets.filter((t) => t.user_id === userId);
    // Enrich with event details
    const enriched = userTickets.map((t) => {
        const evt = dataStore_1.dataStore.events.find((e) => e.id === t.event_id);
        return {
            ...t,
            event_name: evt?.name || 'Unknown Event',
            event_date: evt?.start_date,
            event_end_date: evt?.end_date,
            location: evt?.location,
            venue_name: evt?.venue_name,
            banner_url: evt?.banner_url,
        };
    });
    res.json(apiResponse_1.ApiResponse.success(enriched, 'My tickets retrieved'));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/:id/qr-token
// Auth: authenticate
// Returns HMAC-signed time-window QR token (30-second rotation)
// SKILLS.md § Skill 3: enkripsi/dekripsi di server, key tidak pernah ke client
// ─────────────────────────────────────────────────────────────────────────────
async function getDynamicQrToken(req, res) {
    const { id } = req.params;
    const userId = req.user?.userId;
    const ticket = dataStore_1.dataStore.tickets.find((t) => t.id === id);
    if (!ticket) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Ticket not found', 404));
        return;
    }
    if (ticket.user_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'gate_staff') {
        res.status(403).json(apiResponse_1.ApiResponse.error('Access denied to this ticket QR', 403));
        return;
    }
    if (ticket.status === 'used') {
        res.status(410).json(apiResponse_1.ApiResponse.error('This ticket has already been used', 410));
        return;
    }
    if (ticket.status === 'void' || ticket.status === 'refunded') {
        res.status(410).json(apiResponse_1.ApiResponse.error(`Ticket is ${ticket.status} and cannot generate QR`, 410));
        return;
    }
    // ── 30-second time window (TOTP-style) ──────────────────────────────────
    const nowSec = Math.floor(Date.now() / 1000);
    const timeWindow = Math.floor(nowSec / QR_WINDOW_SEC);
    const secondsRemaining = QR_WINDOW_SEC - (nowSec % QR_WINDOW_SEC);
    // ── HMAC-SHA256 signature: ticket_id + qr_seed + timeWindow ─────────────
    // Key: QR_AES_KEY from env (platform secret, never leaves server)
    const hmac = crypto_1.default.createHmac('sha256', env_1.env.QR_AES_KEY || env_1.env.JWT_SECRET);
    hmac.update(`${ticket.id}:${ticket.qr_seed}:${timeWindow}`);
    const signature = hmac.digest('hex').substring(0, 32);
    const payload = {
        tkt: ticket.id,
        evt: ticket.event_id,
        w: timeWindow,
        sig: signature,
    };
    // Base64-encoded compact payload — gate endpoint will decode + verify HMAC
    const qrToken = Buffer.from(JSON.stringify(payload)).toString('base64url');
    res.json(apiResponse_1.ApiResponse.success({
        ticket_id: ticket.id,
        qr_token: qrToken,
        time_window: timeWindow,
        expires_in_seconds: secondsRemaining,
        refresh_at_seconds: Math.max(secondsRemaining - 3, 1), // refresh 3s before expiry
        status: ticket.status,
    }, 'Dynamic QR token generated'));
}
// ─────────────────────────────────────────────────────────────────────────────
// CRON SWEEPER — sweepExpiredSeats()
// Called by scheduler every 60 seconds (see server.ts startSweeper)
// SKILLS.md § Skill 1 point 5: cron sweeper tiap 1 menit cek locked + expired TTL → available
// ─────────────────────────────────────────────────────────────────────────────
async function sweepExpiredSeats() {
    const now = Date.now();
    let releasedCount = 0;
    for (const seat of dataStore_1.dataStore.seats) {
        if (seat.status !== 'locked')
            continue;
        if (!seat.locked_until) {
            // Locked without TTL timestamp — release defensively
            seat.status = 'available';
            seat.locked_by_user_id = undefined;
            releasedCount++;
            continue;
        }
        const expiresAt = new Date(seat.locked_until).getTime();
        if (expiresAt > now)
            continue; // Still within TTL
        // TTL expired — check Redis too (in case of race condition)
        if (isRedisReady()) {
            const lockKey = seatLockKey(seat.id);
            const redisValue = await redis_1.redis.get(lockKey).catch(() => null);
            if (redisValue !== null) {
                // Redis still has the key (clock skew?) — skip, let Redis TTL expire naturally
                continue;
            }
        }
        // Release expired seat
        const prevOwner = seat.locked_by_user_id;
        seat.status = 'available';
        seat.locked_until = undefined;
        seat.locked_by_user_id = undefined;
        releasedCount++;
        // Broadcast release to seat map viewers
        server_1.io.to(`event:${seat.event_id}`).emit('seat_released', {
            seat_id: seat.id,
            event_id: seat.event_id,
            reason: 'ttl_expired',
        });
        // Publish domain event for analytics
        (0, publisher_1.publishEvent)('seat.released', { seat_id: seat.id, event_id: seat.event_id, user_id: prevOwner, released_by: 'ttl_sweeper' }, 'tenant-001').catch(() => { }); // best-effort, don't crash sweeper
    }
    if (releasedCount > 0) {
        logger_1.logger.info(`[Sweeper] Released ${releasedCount} expired seat lock(s)`);
    }
}
//# sourceMappingURL=ticket.controller.js.map