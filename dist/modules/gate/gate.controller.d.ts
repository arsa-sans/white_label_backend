/**
 * src/modules/gate/gate.controller.ts
 *
 * FASE 7 — Dynamic QR & Gate Service
 *
 * Implementasi mengikuti:
 *   - SKILLS.md § Skill 3 (Dynamic QR Code Rotation): AES-256 / HMAC rotation 30-detik
 *   - SKILLS.md § Skill 4 (Offline-First Gate Validation & Sync): pre-sync data & batch offline log sync
 *
 * Endpoints:
 *   1. validateGateScan   → POST /gate/scan (verifikasi scan < 500ms, Redis lookup + fallback)
 *   2. getPreSyncGateData → GET /gate/sync-data (pre-sync offline ticket HMAC tokens ke device)
 *   3. syncGateLogs       → POST /gate/sync (batch upload log pending saat online kembali)
 *   4. getGateStats       → GET /gate/stats (throughput & total check-in rate per event)
 */
import { Request, Response } from 'express';
export declare function validateGateScan(req: Request, res: Response): Promise<void>;
export declare function getPreSyncGateData(req: Request, res: Response): Promise<void>;
export declare function syncGateLogs(req: Request, res: Response): Promise<void>;
export declare function getGateStats(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=gate.controller.d.ts.map