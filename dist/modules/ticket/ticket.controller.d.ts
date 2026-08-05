/**
 * src/modules/ticket/ticket.controller.ts
 *
 * FASE 4 — Ticket Service (Seat Locking)
 *
 * Implementasi mengikuti SKILLS.md § Skill 1 (Redis Distributed Locking):
 *   1. lockSeat   → SET seat:lock:{seat_id} {userId} NX PX 300000 (5 min TTL)
 *                   + defense-in-depth check di dataStore (menggantikan SELECT FOR UPDATE di dev mode)
 *                   + broadcast Socket.IO `seat_locked` ke room event
 *   2. releaseSeat → releaseLock Redis (Lua CAS, only release if owner) + update DB status
 *                    + broadcast Socket.IO `seat_released`
 *   3. getDynamicQrToken → HMAC-SHA256 per time-window 30 detik (server-side, key tidak pernah ke client)
 *   4. getMyTickets      → enrich dengan detail event
 *   5. sweepExpiredSeats → cron sweeper, dipanggil dari scheduler
 *
 * Fallback dev mode: jika Redis tidak tersedia (ECONNREFUSED), operasi lock jatuh ke in-memory
 * dataStore saja agar developer bisa kerja tanpa infra Redis berjalan.
 */
import { Request, Response } from 'express';
export declare function lockSeat(req: Request, res: Response): Promise<void>;
export declare function releaseSeat(req: Request, res: Response): Promise<void>;
export declare function getMyTickets(req: Request, res: Response): Promise<void>;
export declare function getDynamicQrToken(req: Request, res: Response): Promise<void>;
export declare function sweepExpiredSeats(): Promise<void>;
//# sourceMappingURL=ticket.controller.d.ts.map