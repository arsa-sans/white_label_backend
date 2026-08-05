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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=cashless.routes.d.ts.map