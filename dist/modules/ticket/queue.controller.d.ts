/**
 * src/modules/ticket/queue.controller.ts
 *
 * FASE 6 — Virtual Waiting Room (Queue Management)
 *
 * Implementasi mengikuti SKILLS.md § Skill 5 (Virtual Waiting Room):
 *   1. joinQueue   → ZADD queue:{event_id} {timestamp} {session_id} di Redis / in-memory fallback
 *   2. getQueueStatus → ZRANK queue:{event_id} {session_id} → hitung posisi antrean & estimasi tunggu
 *   3. admitQueue  → admit batch user teratas (set session admitted TTL 10 menit di Redis)
 *                    + broadcast update via Socket.IO ke room event
 *   4. checkAdmitted → helper/middleware untuk validasi apakah user sudah di-admit sebelum boleh hit lockSeat
 */
import { Request, Response } from 'express';
export declare function joinQueue(req: Request, res: Response): Promise<void>;
export declare function getQueueStatus(req: Request, res: Response): Promise<void>;
export declare function admitQueue(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=queue.controller.d.ts.map