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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=analytics.routes.d.ts.map