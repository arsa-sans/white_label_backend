/**
 * src/modules/analytics/analytics.routes.ts
 *
 * FASE 10 — Analytics & Organizer Dashboard routes
 *
 * Endpoints:
 *   GET  /analytics/dashboard       — ringkasan revenue, okupansi, check-in rate real-time
 *   GET  /analytics/occupancy       — laporan okupansi kategori kursi
 *   GET  /analytics/gate-throughput — statistik kecepatan scan gate per jam
 *   POST /analytics/payouts/request — pengajuan pencairan dana (organizer)
 *   GET  /analytics/payouts         — daftar pengajuan payout
 *   PUT  /analytics/payouts/:id/status — update status pencairan (admin approve/pay)
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  getDashboardMetrics,
  getOccupancyReport,
  getGateThroughput,
  requestPayout,
  getPayouts,
  updatePayoutStatus,
  exportSales,
  exportGateLogs,
  exportBoothTransactions,
} from './analytics.controller';

const router = Router();

router.get('/dashboard', authenticate, requireRole(['organizer', 'admin', 'superadmin']), getDashboardMetrics);
router.get('/occupancy', authenticate, getOccupancyReport);
router.get('/gate-throughput', authenticate, requireRole(['organizer', 'admin', 'superadmin']), getGateThroughput);

// Excel / Spreadsheet Export Routes
router.get('/export/sales', authenticate, requireRole(['organizer', 'admin', 'superadmin']), exportSales);
router.get('/export/gate-logs', authenticate, requireRole(['organizer', 'admin', 'superadmin']), exportGateLogs);
router.get('/export/booth-transactions', authenticate, requireRole(['organizer', 'admin', 'superadmin']), exportBoothTransactions);

router.post('/payouts/request', authenticate, requireRole(['organizer', 'admin', 'superadmin']), requestPayout);
router.get('/payouts', authenticate, requireRole(['organizer', 'admin', 'superadmin']), getPayouts);
router.put('/payouts/:id/status', authenticate, requireRole(['admin', 'superadmin']), updatePayoutStatus);

export default router;
