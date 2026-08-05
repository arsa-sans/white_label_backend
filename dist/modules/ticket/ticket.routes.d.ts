/**
 * src/modules/ticket/ticket.routes.ts
 *
 * FASE 4 — Ticket Service routes
 * FASE 6 — Virtual Waiting Room routes
 *
 * Endpoints:
 *   POST /tickets/lock-seat        — lock kursi ke user (Redis NX TTL 5 min)
 *   POST /tickets/release-seat     — manual cancel / release lock
 *   GET  /tickets/my-tickets       — daftar tiket milik user login
 *   GET  /tickets/:id/qr-token     — dynamic QR token (30-detik rotation)
 *   POST /tickets/queue/join       — join virtual waiting room
 *   GET  /tickets/queue/status     — check posisi antrean real-time
 *   POST /tickets/queue/admit      — admit batch antrean (organizer/admin only)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=ticket.routes.d.ts.map