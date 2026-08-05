"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const gate_controller_1 = require("./gate.controller");
const router = (0, express_1.Router)();
router.post('/scan', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['gate_staff', 'admin', 'organizer', 'superadmin']), gate_controller_1.validateGateScan);
router.get('/sync-data', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['gate_staff', 'admin', 'organizer', 'superadmin']), gate_controller_1.getPreSyncGateData);
router.post('/sync', auth_middleware_1.authenticate, gate_controller_1.syncGateLogs);
router.get('/stats', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['gate_staff', 'admin', 'organizer', 'superadmin']), gate_controller_1.getGateStats);
exports.default = router;
//# sourceMappingURL=gate.routes.js.map