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

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  createOrder,
  processPayment,
  midtransWebhook,
  getOrder,
  listMyOrders,
} from './payment.controller';

const router = Router();

// ── Authenticated routes ──────────────────────────────────────────────────────
router.post('/orders', authenticate, createOrder);
router.get('/orders', authenticate, listMyOrders);
router.get('/orders/:id', authenticate, getOrder);
router.post('/orders/:id/pay', authenticate, processPayment);

// ── Webhook — no auth (called by Midtrans server) ────────────────────────────
// Signature is verified inside the handler (SHA-512)
router.post('/webhook/midtrans', midtransWebhook);

export default router;
