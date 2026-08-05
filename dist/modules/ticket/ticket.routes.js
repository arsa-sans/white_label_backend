"use strict";
/**
 * src/modules/ticket/ticket.routes.ts
 *
 * FASE 4 — Ticket Service routes
 * FASE 6 — Virtual Waiting Room routes
 *
 * Endpoints:
 *   POST /tickets/lock-seat        — lock kursi ke user (Redis NX TTL 5 min)
 *   POST /tickets/release-seat     — manual cancel / release lock
 *   GET  /tickets/my-tickets       — daftar tiket milik user login
 *   GET  /tickets/:id/qr-token     — dynamic QR token (30-detik rotation)
 *   POST /tickets/queue/join       — join virtual waiting room
 *   GET  /tickets/queue/status     — check posisi antrean real-time
 *   POST /tickets/queue/admit      — admit batch antrean (organizer/admin only)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const ticket_controller_1 = require("./ticket.controller");
const queue_controller_1 = require("./queue.controller");
const router = (0, express_1.Router)();
// Virtual Waiting Room — FASE 6
router.post('/queue/join', auth_middleware_1.authenticate, queue_controller_1.joinQueue);
router.get('/queue/status', auth_middleware_1.authenticate, queue_controller_1.getQueueStatus);
router.post('/queue/admit', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin', 'superadmin']), queue_controller_1.admitQueue);
// Seat locking — FASE 4
router.post('/lock-seat', auth_middleware_1.authenticate, ticket_controller_1.lockSeat);
router.post('/release-seat', auth_middleware_1.authenticate, ticket_controller_1.releaseSeat);
// Ticket retrieval
router.get('/my-tickets', auth_middleware_1.authenticate, ticket_controller_1.getMyTickets);
router.get('/:id/qr-token', auth_middleware_1.authenticate, ticket_controller_1.getDynamicQrToken);
exports.default = router;
//# sourceMappingURL=ticket.routes.js.map