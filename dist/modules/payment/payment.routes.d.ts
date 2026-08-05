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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=payment.routes.d.ts.map