/**
 * src/modules/gate/gate.routes.ts
 *
 * FASE 7 — Dynamic QR & Gate Service routes
 *
 * Endpoints:
 *   POST /gate/scan        — validasi dynamic QR scan (< 500ms target)
 *   GET  /gate/sync-data   — pre-sync offline dataset
 *   POST /gate/sync        — upload batch log scan offline
 *   GET  /gate/stats       — statistik check-in real-time
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  validateGateScan,
  getPreSyncGateData,
  syncGateLogs,
  getGateStats,
} from './gate.controller';

const router = Router();

router.post('/scan', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), validateGateScan);
router.get('/sync-data', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), getPreSyncGateData);
router.post('/sync', authenticate, syncGateLogs);
router.get('/stats', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), getGateStats);

export default router;
