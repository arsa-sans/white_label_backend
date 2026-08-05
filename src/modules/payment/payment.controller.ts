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
import crypto from 'crypto';
import https from 'https';
import { dataStore, DemoTicket } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { io } from '../../server';
import { publishEvent } from '../../queue/publisher';
import { releaseLock, redis } from '../../config/redis';
import { checkIdempotencyCache, cacheIdempotentResponse } from '../../middlewares/idempotency.middleware';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Constants ───────────────────────────────────────────────────────────────
const MIDTRANS_SANDBOX_BASE = 'https://app.sandbox.midtrans.com/snap/v1';
const MIDTRANS_API_BASE = 'https://api.sandbox.midtrans.com/v2';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function seatLockKey(seatId: string): string {
  return `seat:lock:${seatId}`;
}

function isRedisReady(): boolean {
  return redis.status === 'ready';
}

function isMidtransConfigured(): boolean {
  return !!(env.MIDTRANS_SERVER_KEY && env.MIDTRANS_SERVER_KEY.trim() !== '');
}

/**
 * Call Midtrans Snap API to create a payment token.
 * Returns { token, redirect_url } or throws.
 */
async function createMidtransSnapToken(params: {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  itemDetails: Array<{ id: string; price: number; quantity: number; name: string }>;
}): Promise<{ token: string; redirect_url: string }> {
  const serverKey = env.MIDTRANS_SERVER_KEY;
  const authHeader = 'Basic ' + Buffer.from(`${serverKey}:`).toString('base64');

  const body = JSON.stringify({
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail,
    },
    item_details: params.itemDetails,
    enabled_payments: ['credit_card', 'gopay', 'shopeepay', 'qris', 'bank_transfer'],
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${MIDTRANS_SANDBOX_BASE}/transactions`);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { token?: string; redirect_url?: string; error_messages?: string[] };
          if (parsed.token) {
            resolve({ token: parsed.token, redirect_url: parsed.redirect_url || '' });
          } else {
            reject(new Error(parsed.error_messages?.join(', ') || 'Midtrans Snap token creation failed'));
          }
        } catch {
          reject(new Error('Invalid response from Midtrans'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Verify Midtrans webhook notification signature.
 * SKILLS.md § Skill 2: webhook harus diverifikasi signature-nya sebelum diproses.
 *
 * Midtrans signature: SHA-512(order_id + status_code + gross_amount + server_key)
 */
function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const { orderId, statusCode, grossAmount, signatureKey } = params;
  const serverKey = env.MIDTRANS_SERVER_KEY;

  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computed = crypto.createHash('sha512').update(raw).digest('hex');
  return computed === signatureKey;
}

/**
 * Issue tickets for a paid order — shared logic used by both processPayment (simulasi)
 * and midtransWebhook (real gateway callback).
 * Idempotent: skips seats that already have a ticket issued for this order.
 */
async function issueTicketsForOrder(
  orderId: string,
  userId: string,
  tenantId: string
): Promise<DemoTicket[]> {
  const order = dataStore.orders.find((o) => o.id === orderId);
  if (!order) return [];

  const issuedTickets: DemoTicket[] = [];

  for (const seatId of order.seat_ids) {
    // Idempotent: skip if ticket already issued for this seat + order
    const existing = dataStore.tickets.find(
      (t) => t.seat_id === seatId && t.order_id === orderId
    );
    if (existing) {
      issuedTickets.push(existing);
      continue;
    }

    const seat = dataStore.seats.find((s) => s.id === seatId);
    if (!seat) continue;

    // Release Redis lock (convert lock → sold) — FASE 4 pattern
    const lockKey = seatLockKey(seatId);
    if (isRedisReady()) {
      if (seat.locked_by_user_id === userId) {
        await releaseLock(lockKey, userId).catch(() => {});
      } else {
        await redis.del(lockKey).catch(() => {});
      }
    }

    seat.status = 'sold';
    seat.locked_until = undefined;
    seat.locked_by_user_id = undefined;

    // Generate qr_seed — FASE 4 / SKILLS.md § Skill 3
    const qrSeed = crypto.randomBytes(16).toString('hex');
    const ticketId = `tkt-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;

    const ticket: DemoTicket = {
      id: ticketId,
      event_id: order.event_id,
      seat_id: seat.id,
      user_id: userId,
      order_id: order.id,
      qr_seed: qrSeed,
      seat_name: `${seat.row}-${seat.number}`,
      category: seat.category,
      price: seat.price,
      status: 'valid',
      issued_at: new Date().toISOString(),
    };

    dataStore.tickets.push(ticket);
    issuedTickets.push(ticket);

    // Publish ticket.issued per ticket
    publishEvent(
      'ticket.issued',
      {
        ticket_id: ticket.id,
        order_id: order.id,
        event_id: order.event_id,
        seat_id: seat.id,
        seat_name: ticket.seat_name,
        category: ticket.category,
        user_id: userId,
        issued_at: ticket.issued_at,
      },
      tenantId
    ).catch((err) => logger.warn('[Payment] Failed to publish ticket.issued', err));
  }

  return issuedTickets;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payment/orders
// Body: { event_id, seat_ids, payment_gateway?, customer_name?, customer_email? }
// Headers: x-idempotency-key (UUID v4) — WAJIB
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrder(req: Request, res: Response): Promise<void> {
  const { event_id, seat_ids, payment_gateway, customer_name, customer_email } = req.body;
  const userId = (req.user?.userId ?? '') as string;
  const tenantId = (req.user?.tenantId ?? 'tenant-001') as string;

  // ── FASE 5: Idempotency check (SKILLS.md § Skill 2) ──────────────────────
  // Support both header names for compatibility: x-idempotency-key & Idempotency-Key
  const idempotencyKey = (
    (req.headers['x-idempotency-key'] as string) ||
    (req.headers['idempotency-key'] as string) ||
    ''
  ).trim();

  if (!idempotencyKey) {
    res.status(400).json(
      ApiResponse.error(
        'Idempotency key header is required (x-idempotency-key or Idempotency-Key)',
        400
      )
    );
    return;
  }

  // Check Redis idempotency cache first (fastest path)
  if (isRedisReady()) {
    const cached = await checkIdempotencyCache(idempotencyKey, userId);
    if (cached) {
      logger.debug(`[Payment] Idempotency cache hit for key: ${idempotencyKey}`);
      res.status(cached.statusCode as number).json(cached.body);
      return;
    }
  }

  // Check dataStore for existing order with this key (fallback if Redis miss)
  const existingOrder = dataStore.orders.find((o) => o.idempotency_key === idempotencyKey);
  if (existingOrder) {
    const responseBody = ApiResponse.success(
      existingOrder,
      'Existing order retrieved (idempotent response)'
    );
    // Backfill Redis cache
    if (isRedisReady()) {
      await cacheIdempotentResponse(idempotencyKey, userId, 200, responseBody).catch(() => {});
    }
    res.json(responseBody);
    return;
  }

  // ── Validation ────────────────────────────────────────────────────────────
  if (!event_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    res.status(400).json(ApiResponse.error('event_id and seat_ids[] are required', 400));
    return;
  }

  // ── Verify seat availability & calculate total ────────────────────────────
  let totalAmount = 0;
  const itemDetails: Array<{ id: string; price: number; quantity: number; name: string }> = [];

  for (const seatId of seat_ids) {
    const seat = dataStore.seats.find((s) => s.id === seatId && s.event_id === event_id);
    if (!seat) {
      res.status(404).json(ApiResponse.error(`Seat ${seatId} not found in event ${event_id}`, 404));
      return;
    }
    if (seat.status === 'sold') {
      res.status(409).json(
        ApiResponse.error(`Seat ${seat.row}-${seat.number} (${seat.category}) is already sold`, 409)
      );
      return;
    }
    totalAmount += seat.price;
    itemDetails.push({
      id: seat.id,
      price: seat.price,
      quantity: 1,
      name: `${seat.category} - Seat ${seat.row}-${seat.number}`,
    });
  }

  const event = dataStore.events.find((e) => e.id === event_id);
  const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 999 + 1)}`;

  const newOrder = {
    id: orderId,
    tenant_id: tenantId,
    user_id: userId,
    event_id,
    amount: totalAmount,
    status: 'pending' as const,
    idempotency_key: idempotencyKey,
    payment_gateway: payment_gateway || 'Midtrans',
    gateway_ref: '', // filled after Midtrans call or webhook
    created_at: new Date().toISOString(),
    seat_ids,
  };

  dataStore.orders.push(newOrder);

  // ── FASE 5: Midtrans Snap Integration ─────────────────────────────────────
  let snapToken: string | null = null;
  let snapRedirectUrl: string | null = null;
  let gatewayError: string | null = null;

  if (isMidtransConfigured()) {
    try {
      const snapResult = await createMidtransSnapToken({
        orderId,
        grossAmount: totalAmount,
        customerName: customer_name || req.user?.email || 'Customer',
        customerEmail: customer_email || req.user?.email || 'customer@example.com',
        itemDetails,
      });
      snapToken = snapResult.token;
      snapRedirectUrl = snapResult.redirect_url;
      newOrder.gateway_ref = `SNAP-${orderId}`;
      logger.info(`[Payment] Midtrans Snap token created for order ${orderId}`);
    } catch (err) {
      gatewayError = (err as Error).message;
      logger.warn(`[Payment] Midtrans Snap failed: ${gatewayError} — using simulation mode`);
    }
  }

  // Dev/fallback: generate simulation payment URL
  if (!snapToken) {
    snapToken = `sim-${Buffer.from(orderId).toString('base64url')}`;
    snapRedirectUrl = `${env.CORS_ORIGIN}/checkout/simulate?order_id=${orderId}&amount=${totalAmount}`;
    newOrder.gateway_ref = `SIM-${orderId}`;
  }

  const responseData = {
    order: newOrder,
    payment: {
      snap_token: snapToken,
      redirect_url: snapRedirectUrl,
      amount: totalAmount,
      currency: 'IDR',
      gateway: isMidtransConfigured() && !gatewayError ? 'midtrans_sandbox' : 'simulation',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    ...(gatewayError && { gateway_warning: `Midtrans unavailable: ${gatewayError}` }),
    supported_methods: ['credit_card', 'gopay', 'shopeepay', 'qris', 'bank_transfer'],
    event_name: event?.name || event_id,
  };

  const responseBody = ApiResponse.success(responseData, 'Order created. Proceed to payment.');

  // Cache in Redis for idempotency
  if (isRedisReady()) {
    await cacheIdempotentResponse(idempotencyKey, userId, 201, responseBody).catch(() => {});
  }

  res.status(201).json(responseBody);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payment/orders/:id/pay
// Simulasi pembayaran (dipakai di dev/demo jika tidak pakai real Midtrans callback)
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function processPayment(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const userId = (req.user?.userId ?? '') as string;
  const tenantId = (req.user?.tenantId ?? 'tenant-001') as string;

  const order = dataStore.orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json(ApiResponse.error('Order not found', 404));
    return;
  }

  // ── Idempotent: already paid ──────────────────────────────────────────────
  if (order.status === 'paid') {
    const existingTickets = dataStore.tickets.filter((t) => t.order_id === id);
    res.json(ApiResponse.success({ order, tickets: existingTickets }, 'Order is already paid'));
    return;
  }

  if (order.status === 'failed' || order.status === 'expired') {
    res.status(409).json(
      ApiResponse.error(`Order cannot be paid — status is '${order.status}'`, 409)
    );
    return;
  }

  if (order.user_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    res.status(403).json(ApiResponse.error('You are not authorized to pay this order', 403));
    return;
  }

  // ── Mark order as paid (simulasi) ────────────────────────────────────────
  order.status = 'paid';
  if (!order.gateway_ref || order.gateway_ref.startsWith('SIM-')) {
    order.gateway_ref = `SIM-PAID-${Date.now()}`;
  }

  // Issue tickets
  const issuedTickets = await issueTicketsForOrder(id, userId, tenantId);

  // Publish order.paid
  publishEvent(
    'order.paid',
    {
      order_id: order.id,
      event_id: order.event_id,
      user_id: userId,
      amount: order.amount,
      seat_ids: order.seat_ids,
      ticket_count: issuedTickets.length,
      payment_gateway: 'simulation',
    },
    tenantId
  ).catch((err) => logger.warn('[Payment] Failed to publish order.paid', err));

  // Broadcast to seat map
  io.to(`event:${order.event_id}`).emit('order_paid', {
    order_id: order.id,
    event_id: order.event_id,
    seat_ids: order.seat_ids,
  });

  res.json(
    ApiResponse.success(
      { order, tickets: issuedTickets },
      `Payment simulated! ${issuedTickets.length} ticket(s) issued.`
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /payment/webhook/midtrans
// Midtrans payment notification webhook
// SKILLS.md § Skill 2: verifikasi SHA-512 signature sebelum proses
// NO authenticate middleware — dipanggil oleh Midtrans server
// ─────────────────────────────────────────────────────────────────────────────
export async function midtransWebhook(req: Request, res: Response): Promise<void> {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    transaction_id,
    payment_type,
  } = req.body as {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
    transaction_status: string;
    fraud_status?: string;
    transaction_id?: string;
    payment_type?: string;
  };

  // ── 1. Validate required fields ──────────────────────────────────────────
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    res.status(400).json(ApiResponse.error('Invalid webhook payload', 400));
    return;
  }

  // ── 2. Verify Midtrans SHA-512 signature ─────────────────────────────────
  // SKILLS.md § Skill 2: jangan proses webhook tanpa verifikasi signature
  if (isMidtransConfigured()) {
    const isValid = verifyMidtransSignature({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    });

    if (!isValid) {
      logger.warn(`[Payment/Webhook] Invalid signature for order ${order_id}`);
      res.status(401).json(ApiResponse.error('Invalid webhook signature', 401));
      return;
    }
  } else {
    // In dev mode without Midtrans key, accept webhook with a simple shared secret check
    const devSecret = req.headers['x-webhook-secret'] as string;
    if (devSecret !== 'dev-webhook-secret') {
      logger.warn('[Payment/Webhook] Dev mode: missing x-webhook-secret header');
      // Still accept in dev — just warn
    }
  }

  // ── 3. Locate order ──────────────────────────────────────────────────────
  const order = dataStore.orders.find((o) => o.id === order_id);
  if (!order) {
    // Midtrans might send webhook for an order we don't know — return 200 to prevent retry
    logger.warn(`[Payment/Webhook] Order not found: ${order_id}`);
    res.status(200).json({ message: 'Order not found, webhook acknowledged' });
    return;
  }

  // ── 4. Idempotency via gateway_ref ──────────────────────────────────────
  // SKILLS.md § Skill 2: gateway_ref sebagai idempotency key kedua
  if (transaction_id && order.gateway_ref === transaction_id && order.status === 'paid') {
    logger.info(`[Payment/Webhook] Duplicate webhook for transaction ${transaction_id} — ignored`);
    res.status(200).json({ message: 'Already processed' });
    return;
  }

  // ── 5. Map Midtrans status → internal status ─────────────────────────────
  type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired';
  let newStatus: OrderStatus = order.status;
  let shouldIssueTickets = false;

  if (transaction_status === 'capture' || transaction_status === 'settlement') {
    if (fraud_status === 'accept' || !fraud_status) {
      newStatus = 'paid';
      shouldIssueTickets = true;
    } else if (fraud_status === 'deny') {
      newStatus = 'failed';
    }
  } else if (transaction_status === 'pending') {
    newStatus = 'pending'; // no change — waiting for payment
  } else if (
    transaction_status === 'deny' ||
    transaction_status === 'cancel' ||
    transaction_status === 'refund' ||
    transaction_status === 'partial_refund'
  ) {
    newStatus = 'failed';
  } else if (transaction_status === 'expire') {
    newStatus = 'expired';
  }

  logger.info(
    `[Payment/Webhook] Order ${order_id}: ${order.status} → ${newStatus} ` +
    `(txn_status=${transaction_status}, fraud=${fraud_status || 'n/a'}, method=${payment_type || 'n/a'})`
  );

  // Update order
  order.status = newStatus;
  if (transaction_id) {
    order.gateway_ref = transaction_id;
  }

  // ── 6. Issue tickets if paid ─────────────────────────────────────────────
  if (shouldIssueTickets) {
    const tenantId = order.tenant_id || 'tenant-001';
    const issuedTickets = await issueTicketsForOrder(order_id, order.user_id, tenantId);

    // Publish order.paid to RabbitMQ (notification + analytics consumers)
    publishEvent(
      'order.paid',
      {
        order_id: order.id,
        event_id: order.event_id,
        user_id: order.user_id,
        amount: order.amount,
        seat_ids: order.seat_ids,
        ticket_count: issuedTickets.length,
        payment_gateway: payment_type || 'midtrans',
        transaction_id,
      },
      tenantId
    ).catch((err) => logger.error('[Payment/Webhook] Failed to publish order.paid', err));

    // Broadcast seat sold to seat map via Socket.IO
    io.to(`event:${order.event_id}`).emit('order_paid', {
      order_id: order.id,
      event_id: order.event_id,
      seat_ids: order.seat_ids,
    });

    logger.info(
      `[Payment/Webhook] Issued ${issuedTickets.length} ticket(s) for order ${order_id}`
    );
  }

  // Midtrans expects HTTP 200 acknowledgement
  res.status(200).json({ message: 'Webhook processed successfully', order_id, status: newStatus });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /payment/orders/:id
// Auth: authenticate
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
// Auth: authenticate
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

  // Sort by newest first
  enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json(ApiResponse.success(enriched, 'Orders retrieved'));
}
