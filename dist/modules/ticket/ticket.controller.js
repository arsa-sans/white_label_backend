"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockSeat = lockSeat;
exports.getMyTickets = getMyTickets;
exports.getDynamicQrToken = getDynamicQrToken;
const crypto_1 = __importDefault(require("crypto"));
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
const server_1 = require("../../server");
const env_1 = require("../../config/env");
async function lockSeat(req, res) {
    const { event_id, seat_id } = req.body;
    const userId = req.user?.userId;
    if (!event_id || !seat_id) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id and seat_id are required', 400));
        return;
    }
    const seat = dataStore_1.dataStore.seats.find((s) => s.id === seat_id && s.event_id === event_id);
    if (!seat) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Seat not found', 404));
        return;
    }
    // Check if already sold or locked by another user
    const now = Date.now();
    if (seat.status === 'sold') {
        res.status(409).json(apiResponse_1.ApiResponse.error('Seat is already sold', 409));
        return;
    }
    if (seat.status === 'locked' && seat.locked_until) {
        if (new Date(seat.locked_until).getTime() > now && seat.locked_by_user_id !== userId) {
            res.status(409).json(apiResponse_1.ApiResponse.error('Seat is currently locked by another user', 409));
            return;
        }
    }
    // Lock for 5 minutes
    const ttlMs = 5 * 60 * 1000;
    const lockedUntil = new Date(now + ttlMs).toISOString();
    seat.status = 'locked';
    seat.locked_until = lockedUntil;
    seat.locked_by_user_id = userId;
    // Broadcast lock update to event room via Socket.IO
    server_1.io.to(`event:${event_id}`).emit('seat_locked', {
        seat_id,
        event_id,
        locked_until: lockedUntil,
    });
    res.json(apiResponse_1.ApiResponse.success({
        seat_id,
        event_id,
        status: 'locked',
        locked_until: lockedUntil,
        expires_in_seconds: 300,
    }, 'Seat locked successfully'));
}
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
            location: evt?.location,
            venue_name: evt?.venue_name,
            banner_url: evt?.banner_url,
        };
    });
    res.json(apiResponse_1.ApiResponse.success(enriched, 'My tickets retrieved'));
}
/**
 * Generate Dynamic QR Token
 * Rotates every 30 seconds based on qr_seed + timestamp window
 */
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
    // 30-second window timestamp
    const nowSec = Math.floor(Date.now() / 1000);
    const timeWindow = Math.floor(nowSec / 30);
    const secondsRemaining = 30 - (nowSec % 30);
    // Create HMAC signature using JWT secret & qr_seed & timeWindow
    const hmac = crypto_1.default.createHmac('sha256', env_1.env.JWT_SECRET || 'secret');
    hmac.update(`${ticket.id}:${ticket.qr_seed}:${timeWindow}`);
    const signature = hmac.digest('hex').substring(0, 16);
    const payload = {
        tkt: ticket.id,
        evt: ticket.event_id,
        seed: ticket.qr_seed.substring(0, 8),
        w: timeWindow,
        sig: signature,
    };
    const qrToken = Buffer.from(JSON.stringify(payload)).toString('base64');
    res.json(apiResponse_1.ApiResponse.success({
        ticket_id: ticket.id,
        qr_token: qrToken,
        time_window: timeWindow,
        expires_in_seconds: secondsRemaining,
        status: ticket.status,
    }, 'Dynamic QR token generated'));
}
//# sourceMappingURL=ticket.controller.js.map