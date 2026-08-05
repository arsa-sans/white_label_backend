"use strict";
/**
 * src/modules/gate/gate.controller.ts
 *
 * FASE 7 — Dynamic QR & Gate Service
 *
 * Implementasi mengikuti:
 *   - SKILLS.md § Skill 3 (Dynamic QR Code Rotation): AES-256 / HMAC rotation 30-detik
 *   - SKILLS.md § Skill 4 (Offline-First Gate Validation & Sync): pre-sync data & batch offline log sync
 *
 * Endpoints:
 *   1. validateGateScan   → POST /gate/scan (verifikasi scan < 500ms, Redis lookup + fallback)
 *   2. getPreSyncGateData → GET /gate/sync-data (pre-sync offline ticket HMAC tokens ke device)
 *   3. syncGateLogs       → POST /gate/sync (batch upload log pending saat online kembali)
 *   4. getGateStats       → GET /gate/stats (throughput & total check-in rate per event)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGateScan = validateGateScan;
exports.getPreSyncGateData = getPreSyncGateData;
exports.syncGateLogs = syncGateLogs;
exports.getGateStats = getGateStats;
const crypto_1 = __importDefault(require("crypto"));
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
const logger_1 = require("../../utils/logger");
const QR_WINDOW_SEC = 30;
function isRedisReady() {
    return redis_1.redis.status === 'ready';
}
/**
 * Helper: Derive HMAC signature for a ticket in a given time window.
 * Formula: HMAC-SHA256(ticket_id + ":" + qr_seed + ":" + time_window, secret=QR_AES_KEY)
 */
function deriveHmac(ticketId, qrSeed, timeWindow) {
    const secret = env_1.env.QR_AES_KEY || env_1.env.JWT_SECRET || 'dev-secret';
    const hmac = crypto_1.default.createHmac('sha256', secret);
    hmac.update(`${ticketId}:${qrSeed}:${timeWindow}`);
    return hmac.digest('hex').substring(0, 32);
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /gate/scan
// Body: { qr_token, gate_device_id }
// Auth: authenticate (role: gate_staff, admin, organizer)
// Target: < 500ms response time
// ─────────────────────────────────────────────────────────────────────────────
async function validateGateScan(req, res) {
    const startTime = Date.now();
    const { qr_token, gate_device_id = 'GATE-WEB-01' } = req.body;
    if (!qr_token) {
        res.status(400).json(apiResponse_1.ApiResponse.error('qr_token is required', 400));
        return;
    }
    try {
        // 1. Decode payload base64url
        const decodedStr = Buffer.from(qr_token, 'base64url').toString('utf-8');
        const payload = JSON.parse(decodedStr);
        const { tkt, w, sig } = payload;
        if (!tkt || w === undefined || !sig) {
            res.json(apiResponse_1.ApiResponse.success({
                result: 'invalid',
                message: 'Malformed QR payload format',
                processing_time_ms: Date.now() - startTime,
            }));
            return;
        }
        // 2. Check time window freshness (±1 window tolerance = 30s drift)
        const nowSec = Math.floor(Date.now() / 1000);
        const currentWindow = Math.floor(nowSec / QR_WINDOW_SEC);
        if (Math.abs(currentWindow - w) > 1) {
            res.json(apiResponse_1.ApiResponse.success({
                result: 'expired',
                ticket_id: tkt,
                message: 'Dynamic QR token has expired. Request visitor to refresh screen.',
                processing_time_ms: Date.now() - startTime,
            }));
            return;
        }
        // 3. Fast lookup: try Redis ticket cache first, fallback to dataStore
        let ticket = dataStore_1.dataStore.tickets.find((t) => t.id === tkt);
        if (!ticket && isRedisReady()) {
            const cached = await redis_1.redis.get(`ticket:${tkt}`).catch(() => null);
            if (cached) {
                ticket = JSON.parse(cached);
            }
        }
        if (!ticket) {
            res.json(apiResponse_1.ApiResponse.success({
                result: 'invalid',
                message: `Ticket '${tkt}' not found in database`,
                processing_time_ms: Date.now() - startTime,
            }));
            return;
        }
        // 4. Verify HMAC signature
        const expectedSig = deriveHmac(ticket.id, ticket.qr_seed, w);
        if (sig !== expectedSig && sig !== expectedSig.substring(0, 16)) {
            res.json(apiResponse_1.ApiResponse.success({
                result: 'invalid',
                ticket_id: ticket.id,
                message: 'Invalid QR cryptographic signature',
                processing_time_ms: Date.now() - startTime,
            }));
            return;
        }
        // 5. Check duplicate (already used)
        if (ticket.status === 'used') {
            const scanLog = {
                id: `scan-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
                ticket_id: ticket.id,
                gate_device_id,
                scanned_at: new Date().toISOString(),
                result: 'duplicate',
                staff_name: req.user?.email || 'Gate Staff',
            };
            dataStore_1.dataStore.gateScanLogs.push(scanLog);
            res.json(apiResponse_1.ApiResponse.success({
                result: 'duplicate',
                ticket_id: ticket.id,
                seat_name: ticket.seat_name,
                category: ticket.category,
                message: 'TICKET ALREADY USED FOR ENTRY',
                processing_time_ms: Date.now() - startTime,
            }));
            return;
        }
        if (ticket.status !== 'valid') {
            res.json(apiResponse_1.ApiResponse.success({
                result: 'invalid',
                ticket_id: ticket.id,
                message: `Ticket status is '${ticket.status.toUpperCase()}'`,
                processing_time_ms: Date.now() - startTime,
            }));
            return;
        }
        // 6. Success! Mark ticket used and append scan log
        ticket.status = 'used';
        const scanLog = {
            id: `scan-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
            ticket_id: ticket.id,
            gate_device_id,
            scanned_at: new Date().toISOString(),
            result: 'valid',
            staff_name: req.user?.email || 'Gate Staff',
        };
        dataStore_1.dataStore.gateScanLogs.push(scanLog);
        const event = dataStore_1.dataStore.events.find((e) => e.id === ticket.event_id);
        res.json(apiResponse_1.ApiResponse.success({
            result: 'valid',
            ticket_id: ticket.id,
            seat_name: ticket.seat_name,
            category: ticket.category,
            event_name: event?.name || ticket.event_id,
            message: 'ENTRY GRANTED - VALID TICKET',
            processing_time_ms: Date.now() - startTime,
        }));
    }
    catch (err) {
        res.json(apiResponse_1.ApiResponse.success({
            result: 'invalid',
            message: 'Malformed or unreadable QR payload string',
            processing_time_ms: Date.now() - startTime,
        }));
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /gate/sync-data
// Query: event_id
// Auth: authenticate (role: gate_staff, admin, organizer)
// SKILLS.md § Skill 4: Pre-sync data for offline-first gate validation
// ─────────────────────────────────────────────────────────────────────────────
async function getPreSyncGateData(req, res) {
    const event_id = req.query.event_id || 'evt-001';
    const validTickets = dataStore_1.dataStore.tickets.filter((t) => t.event_id === event_id && (t.status === 'valid' || t.status === 'used'));
    const nowSec = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(nowSec / QR_WINDOW_SEC);
    // Pre-calculate HMAC tokens for next 10 windows (5 minutes ahead)
    const items = validTickets.map((t) => {
        const windows = [currentWindow - 1, currentWindow, currentWindow + 1, currentWindow + 2];
        const tokens = windows.map((w) => deriveHmac(t.id, t.qr_seed, w));
        return {
            ticket_id: t.id,
            seat_name: t.seat_name,
            category: t.category,
            status: t.status,
            tokens,
        };
    });
    res.json(apiResponse_1.ApiResponse.success({
        event_id,
        synced_at: new Date().toISOString(),
        total_tickets: items.length,
        current_window: currentWindow,
        tickets: items,
    }, 'Offline gate pre-sync dataset retrieved successfully'));
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /gate/sync
// Body: { logs: Array<{ id, ticket_id, gate_device_id, scanned_at, result }> }
// Auth: authenticate
// SKILLS.md § Skill 4: Batch upload pending scan logs with duplicate reconciliation
// ─────────────────────────────────────────────────────────────────────────────
async function syncGateLogs(req, res) {
    const { logs } = req.body;
    if (!Array.isArray(logs)) {
        res.status(400).json(apiResponse_1.ApiResponse.error('logs array is required', 400));
        return;
    }
    let syncedCount = 0;
    let conflictCount = 0;
    for (const log of logs) {
        const ticket = dataStore_1.dataStore.tickets.find((t) => t.id === log.ticket_id);
        // Reconcile status
        if (ticket) {
            if (ticket.status === 'used' && log.result === 'valid') {
                // Double scan conflict detected during offline period
                conflictCount++;
                dataStore_1.dataStore.gateScanLogs.push({
                    id: log.id || `sync-conflict-${Date.now()}-${Math.random()}`,
                    ticket_id: log.ticket_id,
                    gate_device_id: log.gate_device_id || 'OFFLINE-DEVICE',
                    scanned_at: log.scanned_at || new Date().toISOString(),
                    result: 'duplicate',
                    staff_name: 'Offline Sync Reconciler',
                });
                continue;
            }
            if (log.result === 'valid') {
                ticket.status = 'used';
            }
        }
        dataStore_1.dataStore.gateScanLogs.push({
            id: log.id || `sync-${Date.now()}-${Math.random()}`,
            ticket_id: log.ticket_id,
            gate_device_id: log.gate_device_id || 'OFFLINE-DEVICE',
            scanned_at: log.scanned_at || new Date().toISOString(),
            result: log.result || 'valid',
            staff_name: 'Offline Sync Agent',
        });
        syncedCount++;
    }
    logger_1.logger.info(`[Gate] Synced ${syncedCount} scan log(s) with ${conflictCount} conflict(s)`);
    res.json(apiResponse_1.ApiResponse.success({ synced_count: syncedCount, conflict_count: conflictCount }, `${syncedCount} gate scan logs synchronized (${conflictCount} conflict(s) flagged)`));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /gate/stats
// Query: event_id
// Auth: authenticate (role: gate_staff, admin, organizer)
// ─────────────────────────────────────────────────────────────────────────────
async function getGateStats(req, res) {
    const event_id = req.query.event_id || 'evt-001';
    const eventTickets = dataStore_1.dataStore.tickets.filter((t) => t.event_id === event_id);
    const totalIssued = eventTickets.length;
    const totalCheckedIn = eventTickets.filter((t) => t.status === 'used').length;
    const checkInRate = totalIssued > 0 ? ((totalCheckedIn / totalIssued) * 100).toFixed(1) : '0';
    const scanLogs = dataStore_1.dataStore.gateScanLogs;
    const validScans = scanLogs.filter((l) => l.result === 'valid').length;
    const duplicateScans = scanLogs.filter((l) => l.result === 'duplicate').length;
    const invalidScans = scanLogs.filter((l) => l.result === 'invalid').length;
    res.json(apiResponse_1.ApiResponse.success({
        event_id,
        total_issued_tickets: totalIssued,
        total_checked_in: totalCheckedIn,
        check_in_percentage: `${checkInRate}%`,
        valid_scans: validScans,
        duplicate_attempts: duplicateScans,
        invalid_scans: invalidScans,
        active_gate_devices: Array.from(new Set(scanLogs.map((l) => l.gate_device_id))),
    }, 'Gate check-in statistics retrieved'));
}
//# sourceMappingURL=gate.controller.js.map