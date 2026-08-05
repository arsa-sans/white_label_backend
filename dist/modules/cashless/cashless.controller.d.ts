/**
 * src/modules/cashless/cashless.controller.ts
 *
 * FASE 8 — Cashless Service
 *
 * Implementasi mengikuti SKILLS.md § Skill 6 (Cashless Wallet Transaction Safety):
 *   1. getWallet       → GET /cashless/wallet (saldo, NFC UID, history)
 *   2. topupWallet     → POST /cashless/wallet/topup (top-up saldo)
 *   3. pairNfc         → POST /cashless/wallet/pair-nfc (pair wristband NFC UID ↔ user wallet)
 *   4. debitBooth      → POST /cashless/booth/debit (transaksi booth kasir dengan idempotency reference_id & row lock)
 *   5. refundBoothTx   → POST /cashless/booth/refund (refund transaksi booth tertentu)
 *   6. autoRefundJob   → POST /cashless/wallet/auto-refund (refund otomatis sisa saldo post-event)
 *   7. getBoothHistory → GET /cashless/booth/history (riwayat transaksi booth vendor)
 */
import { Request, Response } from 'express';
export declare function getWallet(req: Request, res: Response): Promise<void>;
export declare function topupWallet(req: Request, res: Response): Promise<void>;
export declare function pairNfc(req: Request, res: Response): Promise<void>;
export declare function debitBooth(req: Request, res: Response): Promise<void>;
export declare function refundBoothTx(req: Request, res: Response): Promise<void>;
export declare function autoRefundJob(req: Request, res: Response): Promise<void>;
export declare function getBoothHistory(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=cashless.controller.d.ts.map