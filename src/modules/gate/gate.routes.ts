/**
 * src/modules/gate/gate.routes.ts
 *
 * FASE 7 — Dynamic QR & Gate Service routes
 *
 * Endpoints:
 *   POST /gate/scan        — validasi dynamic QR scan (< 500ms target)
 *   POST /gate/validate    — alias untuk /gate/scan (dipakai oleh web frontend)
 *   GET  /gate/sync-data   — pre-sync offline dataset
 *   POST /gate/sync        — upload batch log scan offline
 *   POST /gate/sync-logs   — alias untuk /gate/sync (dipakai oleh web frontend)
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

// Primary endpoints (mobile app uses these)
router.post('/scan', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), validateGateScan);
router.get('/sync-data', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), getPreSyncGateData);
router.post('/sync', authenticate, syncGateLogs);
router.get('/stats', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), getGateStats);

// Alias endpoints (web frontend uses these)
router.post('/validate', authenticate, requireRole(['gate_staff', 'admin', 'organizer', 'superadmin']), validateGateScan);
router.post('/sync-logs', authenticate, syncGateLogs);

export default router;
