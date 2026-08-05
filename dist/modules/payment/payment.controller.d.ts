/**
 * src/modules/payment/payment.controller.ts
 *
 * FASE 5 — Payment Service (full rewrite)
 *
 * Implementasi mengikuti SKILLS.md § Skill 2 (Idempotency Key):
 *   - createOrder   → idempotency via x-idempotency-key header + Redis cache + dataStore fallback
 *                     → buat Snap token Midtrans (sandbox) + fallback simulasi di dev mode
 *   - processPayment → endpoint simulasi (jika tidak pakai real Midtrans callback)
 *   - midtransWebhook → verifikasi SHA-512 signature Midtrans → update order status
 *                       → publish order.paid + ticket.issued ke RabbitMQ
 *                       → idempotent via gateway_ref
 *   - getOrder      → lihat detail order
 *   - listMyOrders  → semua order user
 *
 * Midtrans sandbox docs:
 *   - Snap: https://snap-docs.midtrans.com/
 *   - Webhook notification: https://docs.midtrans.com/docs/core-api-payment-notification
 *
 * Gateway modes:
 *   - MIDTRANS_SERVER_KEY tersedia → pakai Midtrans Snap API (sandbox)
 *   - tidak ada key → simulasi lokal (dev mode)
 */
import { Request, Response } from 'express';
export declare function createOrder(req: Request, res: Response): Promise<void>;
export declare function processPayment(req: Request, res: Response): Promise<void>;
export declare function midtransWebhook(req: Request, res: Response): Promise<void>;
export declare function getOrder(req: Request, res: Response): Promise<void>;
export declare function listMyOrders(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=payment.controller.d.ts.map