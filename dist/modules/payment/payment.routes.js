"use strict";
/**
 * src/modules/payment/payment.routes.ts
 *
 * FASE 5 — Payment Service routes
 *
 * Endpoints:
 *   POST   /payment/orders                   — create order + Midtrans Snap token
 *                                              Header: x-idempotency-key (UUID v4, WAJIB)
 *   GET    /payment/orders                   — list all orders milik user login
 *   GET    /payment/orders/:id               — detail order + tickets
 *   POST   /payment/orders/:id/pay           — simulasi bayar (dev mode / fallback)
 *   POST   /payment/webhook/midtrans         — Midtrans payment notification (no auth)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const payment_controller_1 = require("./payment.controller");
const router = (0, express_1.Router)();
// ── Authenticated routes ──────────────────────────────────────────────────────
router.post('/orders', auth_middleware_1.authenticate, payment_controller_1.createOrder);
router.get('/orders', auth_middleware_1.authenticate, payment_controller_1.listMyOrders);
router.get('/orders/:id', auth_middleware_1.authenticate, payment_controller_1.getOrder);
router.post('/orders/:id/pay', auth_middleware_1.authenticate, payment_controller_1.processPayment);
// ── Webhook — no auth (called by Midtrans server) ────────────────────────────
// Signature is verified inside the handler (SHA-512)
router.post('/webhook/midtrans', payment_controller_1.midtransWebhook);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map