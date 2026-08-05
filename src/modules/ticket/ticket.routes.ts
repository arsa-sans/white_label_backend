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

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  lockSeat,
  releaseSeat,
  getMyTickets,
  getDynamicQrToken,
} from './ticket.controller';
import {
  joinQueue,
  getQueueStatus,
  admitQueue,
} from './queue.controller';

const router = Router();

// Virtual Waiting Room — FASE 6
router.post('/queue/join', authenticate, joinQueue);
router.get('/queue/status', authenticate, getQueueStatus);
router.post('/queue/admit', authenticate, requireRole(['organizer', 'admin', 'superadmin']), admitQueue);

// Seat locking — FASE 4
router.post('/lock-seat', authenticate, lockSeat);
router.post('/release-seat', authenticate, releaseSeat);

// Ticket retrieval
router.get('/my-tickets', authenticate, getMyTickets);
router.get('/:id/qr-token', authenticate, getDynamicQrToken);

export default router;
