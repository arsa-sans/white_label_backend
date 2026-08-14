/**
 * src/modules/ticket/ticket.routes.ts
 *
 * Phase 4 — Ticket Service routes (Tier Based)
 *
 * Endpoints:
 *   GET  /tickets/my-tickets       — daftar tiket milik user login
 *   GET  /tickets/:id/qr-token     — dynamic QR token (30-detik rotation)
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  getMyTickets,
  getDynamicQrToken,
} from './ticket.controller';
import {
  joinQueue,
  getQueueStatus,
  admitQueue,
} from './queue.controller';
import { requireRole } from '../../middlewares/rbac.middleware';

const router = Router();

// Virtual Waiting Room — FASE 6
router.post('/queue/join', authenticate, joinQueue);
router.get('/queue/status', authenticate, getQueueStatus);
router.post('/queue/admit', authenticate, requireRole(['organizer', 'admin', 'superadmin']), admitQueue);

// Ticket retrieval
router.get('/my-tickets', authenticate, getMyTickets);
router.get('/:id/qr-token', authenticate, getDynamicQrToken);

export default router;
