/**
 * src/modules/ticket/ticket.routes.ts
 *
 * Phase 4 — Ticket Service routes (Tier Based)
 *
 * Endpoints:
 *   GET  /tickets/my-tickets       — daftar tiket milik user login
 *   GET  /tickets/:id/qr-token     — dynamic QR token (30-detik rotation)
 *   (Queue routes are also mounted here for backwards-compatibility with frontend)
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  getMyTickets,
  getDynamicQrToken,
  downloadTicketPdf,
} from './ticket.controller';
import {
  joinQueue,
  getQueueStatus,
  admitQueue,
} from '../queue/queue.controller';

const router = Router();

// Virtual Waiting Room — FASE 6 (legacy mount)
router.post('/queue/join', authenticate, joinQueue);
router.get('/queue/status', authenticate, getQueueStatus);
router.post('/queue/admit', authenticate, requireRole(['organizer', 'admin', 'superadmin']), admitQueue);

// Ticket retrieval & PDF Export
router.get('/my-tickets', authenticate, getMyTickets);
router.get('/:id/qr-token', authenticate, getDynamicQrToken);
router.get('/:id/pdf', authenticate, downloadTicketPdf);

export default router;
