"use strict";
/**
 * src/modules/cashless/cashless.routes.ts
 *
 * FASE 8 — Cashless Service routes
 *
 * Endpoints:
 *   GET  /cashless/wallet             — detail saldo & NFC UID user
 *   POST /cashless/wallet/topup       — top-up saldo wallet
 *   POST /cashless/wallet/pair-nfc    — pair wristband NFC UID ke wallet
 *   POST /cashless/booth/debit        — transaksi debit kasir booth (idempotent reference_id)
 *   POST /cashless/booth/refund       — refund transaksi booth
 *   POST /cashless/wallet/auto-refund — automated post-event refund job (admin/organizer)
 *   GET  /cashless/booth/history      — riwayat transaksi booth
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const cashless_controller_1 = require("./cashless.controller");
const router = (0, express_1.Router)();
router.get('/wallet', auth_middleware_1.authenticate, cashless_controller_1.getWallet);
router.post('/wallet/topup', auth_middleware_1.authenticate, cashless_controller_1.topupWallet);
router.post('/wallet/pair-nfc', auth_middleware_1.authenticate, cashless_controller_1.pairNfc);
router.post('/booth/debit', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['vendor', 'admin', 'organizer', 'superadmin']), cashless_controller_1.debitBooth);
router.post('/booth/refund', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['vendor', 'admin', 'organizer', 'superadmin']), cashless_controller_1.refundBoothTx);
router.get('/booth/history', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['vendor', 'admin', 'organizer', 'superadmin']), cashless_controller_1.getBoothHistory);
router.post('/wallet/auto-refund', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['admin', 'organizer', 'superadmin']), cashless_controller_1.autoRefundJob);
exports.default = router;
//# sourceMappingURL=cashless.routes.js.map