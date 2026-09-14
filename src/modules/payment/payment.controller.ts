/**
 * src/modules/payment/payment.controller.ts
 *
 * Phase 5 — Payment Service Controller (Tier Based)
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { checkIdempotencyCache, cacheIdempotentResponse } from '../../middlewares/idempotency.middleware';
import { redis } from '../../config/redis';
import { logger } from '../../utils/logger';
import { dataStore } from '../../database/dataStore';
import {
  createOrderService,
  processPaymentService,
  processWebhookService,
  MidtransWebhookPayload,
} from './payment.service';

function isRedisReady(): boolean {
  return redis.status === 'ready';
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payment/orders
// Body: { event_id, items: [{tier_id, quantity}], payment_gateway?, customer_name?, customer_email? }
// Headers: x-idempotency-key (UUID v4)
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrder(req: Request, res: Response): Promise<void> {
  const userId = (req.user?.userId ?? '') as string;
  const tenantId = (req.user?.tenantId ?? 'tenant-001') as string;

  const idempotencyKey = (
    (req.headers['x-idempotency-key'] as string) ||
    (req.headers['idempotency-key'] as string) ||
    ''
  ).trim();

  if (!idempotencyKey) {
    res.status(400).json(
      ApiResponse.error('Idempotency key header is required (x-idempotency-key)', 400)
    );
    return;
  }

  // Check Redis idempotency cache
  if (isRedisReady()) {
    const cached = await checkIdempotencyCache(idempotencyKey, userId);
    if (cached) {
      res.status(cached.statusCode as number).json(cached.body);
      return;
    }
  }

  // Check dataStore for existing order with this key
  const existingOrder = dataStore.orders.find((o) => o.idempotency_key === idempotencyKey);
  if (existingOrder) {
    const responseBody = ApiResponse.success(existingOrder, 'Existing order retrieved (idempotent response)');
    if (isRedisReady()) {
      await cacheIdempotentResponse(idempotencyKey, userId, 200, responseBody).catch(() => {});
    }
    res.json(responseBody);
    return;
  }

  try {
    const result = await createOrderService({
      event_id: req.body.event_id,
      items: req.body.items,
      seat_ids: req.body.seat_ids,
      payment_gateway: req.body.payment_gateway,
      payment_method: req.body.payment_method,
      customer_name: req.body.customer_name || req.user?.email,
      customer_email: req.body.customer_email || req.user?.email,
      promo_code: req.body.promo_code,
      idempotency_key: idempotencyKey,
      user_id: userId,
      tenant_id: tenantId,
    });

    const responseBody = ApiResponse.success(result, 'Order created. Proceed to payment.');

    if (isRedisReady()) {
      await cacheIdempotentResponse(idempotencyKey, userId, 201, responseBody).catch(() => {});
    }

    res.status(201).json(responseBody);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json(ApiResponse.error(err.message || 'Failed to create order', status));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payment/orders/:id/pay
// Simulasi pembayaran dev mode
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function processPayment(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const userId = (req.user?.userId ?? '') as string;
  const tenantId = (req.user?.tenantId ?? 'tenant-001') as string;
  const userRole = (req.user?.role ?? 'visitor') as string;

  try {
    const result = await processPaymentService(id, userId, tenantId, userRole);
    res.json(
      ApiResponse.success(
        result,
        `Payment processed! ${result.tickets.length} ticket(s) issued.`
      )
    );
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json(ApiResponse.error(err.message || 'Payment failed', status));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payment/webhook/midtrans
// ─────────────────────────────────────────────────────────────────────────────
export async function midtransWebhook(req: Request, res: Response): Promise<void> {
  try {
    const result = await processWebhookService(req.body as MidtransWebhookPayload);
    res.status(200).json({ message: 'Webhook processed', ...result });
  } catch (err: any) {
    const status = err.statusCode || 400;
    res.status(status).json(ApiResponse.error(err.message || 'Webhook failed', status));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /payment/orders/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function getOrder(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.userId;

  const order = dataStore.orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json(ApiResponse.error('Order not found', 404));
    return;
  }

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  if (order.user_id !== userId && !isAdmin) {
    res.status(403).json(ApiResponse.error('Access denied to this order', 403));
    return;
  }

  const tickets = dataStore.tickets.filter((t) => t.order_id === id);
  const event = dataStore.events.find((e) => e.id === order.event_id);

  res.json(
    ApiResponse.success(
      {
        ...order,
        tickets,
        event_name: event?.name,
        event_date: event?.start_date,
        venue_name: event?.venue_name,
      },
      'Order retrieved'
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /payment/orders
// ─────────────────────────────────────────────────────────────────────────────
export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const userOrders = dataStore.orders.filter((o) => o.user_id === userId);

  const enriched = userOrders.map((o) => {
    const event = dataStore.events.find((e) => e.id === o.event_id);
    const ticketCount = dataStore.tickets.filter((t) => t.order_id === o.id).length;
    return {
      ...o,
      event_name: event?.name,
      event_date: event?.start_date,
      banner_url: event?.banner_url,
      ticket_count: ticketCount,
    };
  });

  enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(ApiResponse.success(enriched, 'Orders retrieved'));
}
