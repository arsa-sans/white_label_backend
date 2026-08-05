"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const analytics_controller_1 = require("./analytics.controller");
const router = (0, express_1.Router)();
router.get('/dashboard', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin', 'superadmin']), analytics_controller_1.getDashboardMetrics);
router.get('/occupancy', auth_middleware_1.authenticate, analytics_controller_1.getOccupancyReport);
router.get('/gate-throughput', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin', 'superadmin']), analytics_controller_1.getGateThroughput);
router.post('/payouts/request', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin', 'superadmin']), analytics_controller_1.requestPayout);
router.get('/payouts', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin', 'superadmin']), analytics_controller_1.getPayouts);
router.put('/payouts/:id/status', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['admin', 'superadmin']), analytics_controller_1.updatePayoutStatus);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map