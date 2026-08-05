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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=gate.routes.d.ts.map