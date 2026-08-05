/**
 * src/modules/payment/payment.service.ts
 *
 * FASE 5 — Payment Service: Business Logic Layer
 *
 * Memisahkan logika bisnis dari HTTP layer (controller).
 * Controller hanya menangani request/response parsing, lalu mendelegasikan ke sini.
 *
 * Sesuai SKILLS.md § Skill 2 (Idempotency Key):
 *   - createOrder     → idempotency via idempotency_key (UNIQUE kolom orders)
 *   - issueTickets    → idempotent per-seat (skip kalau sudah ada tiket untuk order+seat)
 *   - webhook handler → idempotent via gateway_ref (transaction_id dari gateway)
 *
 * Payment gateway modes:
 *   - MIDTRANS_SERVER_KEY tersedia → Midtrans Snap API (sandbox)
 *   - tidak ada key → simulasi lokal (dev mode, tidak butuh akun gateway)
 */

import crypto from 'crypto';
import https from 'https';
import { dataStore, DemoOrder, DemoTicket } from '../../database/dataStore';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { releaseLock, redis } from '../../config/redis';
import { publishEvent } from '../../queue/publisher';
import { io } from '../../server';

// ─── Constants ────────────────────────────────────────────────────────────────
const MIDTRANS_SANDBOX_SNAP_BASE = 'https://app.sandbox.midtrans.com/snap/v1';
const ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CreateOrderInput {
  event_id: string;
  seat_ids: string[];
  payment_gateway?: string;
  customer_name?: string;
  customer_email?: string;
  idempotency_key: string;
  user_id: string;
  tenant_id: string;
}

export interface CreateOrderResult {
  order: DemoOrder;
  snap_token: string;
  redirect_url: string;
  amount: number;
  currency: 'IDR';
  gateway: string;
  expires_at: string;
  event_name: string;
  supported_methods: string[];
  gateway_warning?: string;
}

export interface WebhookProcessResult {
  order_id: string;
  new_status: string;
  tickets_issued: number;
  skipped: boolean; // true jika sudah diproses (idempotent)
}

// ─── Helper: Seat lock key ────────────────────────────────────────────────────
function seatLockKey(seatId: string): string {
  return `seat:lock:${seatId}`;
}

// ─── Helper: Redis readiness ──────────────────────────────────────────────────
function isRedisReady(): boolean {
  return redis.status === 'ready';
}

// ─── Helper: Midtrans configured? ────────────────────────────────────────────
export function isMidtransConfigured(): boolean {
  return !!(env.MIDTRANS_SERVER_KEY && env.MIDTRANS_SERVER_KEY.trim() !== '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Midtrans Snap API: Create payment token
// Docs: https://snap-docs.midtrans.com/#create-transaction
// ─────────────────────────────────────────────────────────────────────────────
export async function createMidtransSnapToken(params: {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  itemDetails: Array<{ id: string; price: number; quantity: number; name: string }>;
}): Promise<{ token: string; redirect_url: string }> {
  const authHeader = 'Basic ' + Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString('base64');

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
    expiry: {
      duration: 24,
      unit: 'hour',
    },
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${MIDTRANS_SANDBOX_SNAP_BASE}/transactions`);
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
          const parsed = JSON.parse(data) as {
            token?: string;
            redirect_url?: string;
            error_messages?: string[];
            status_code?: string;
            status_message?: string;
          };
          if (parsed.token) {
            resolve({ token: parsed.token, redirect_url: parsed.redirect_url || '' });
          } else {
            const msg =
              parsed.error_messages?.join(', ') ||
              parsed.status_message ||
              `Midtrans HTTP ${res.statusCode}`;
            reject(new Error(msg));
          }
        } catch {
          reject(new Error('Invalid JSON response from Midtrans'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Midtrans webhook signature verification
// SKILLS.md § Skill 2: wajib verifikasi sebelum proses apapun
// Formula: SHA-512(order_id + status_code + gross_amount + server_key)
// Docs: https://docs.midtrans.com/docs/core-api-payment-notification#verifying-notification-authenticity
// ─────────────────────────────────────────────────────────────────────────────
export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  if (!params.signatureKey) return false;
  const raw = `${params.orderId}${params.statusCode}${params.grossAmount}${env.MIDTRANS_SERVER_KEY}`;
  const computed = crypto.createHash('sha512').update(raw).digest('hex');
  const bufA = Buffer.from(computed, 'hex');
  const bufB = Buffer.from(params.signatureKey.toLowerCase(), 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation payment URL (dev fallback when no Midtrans key)
// ─────────────────────────────────────────────────────────────────────────────
function buildSimulationUrl(orderId: string, amount: number): string {
  const base = env.CORS_ORIGIN || 'http://localhost:3000';
  return `${base}/checkout/simulate?order_id=${orderId}&amount=${amount}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// createOrder — Business logic (SKILLS.md § Skill 2)
// Idempotency: caller should check idempotency cache BEFORE calling this.
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrderService(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { event_id, seat_ids, payment_gateway, customer_name, customer_email,
          idempotency_key, user_id, tenant_id } = input;

  // ── Validate seats & calculate total ────────────────────────────────────
  let totalAmount = 0;
  const itemDetails: Array<{ id: string; price: number; quantity: number; name: string }> = [];

  for (const seatId of seat_ids) {
    const seat = dataStore.seats.find((s) => s.id === seatId && s.event_id === event_id);
    if (!seat) {
      throw Object.assign(new Error(`Seat ${seatId} not found in event ${event_id}`), { statusCode: 404 });
    }
    if (seat.status === 'sold') {
      throw Object.assign(
        new Error(`Seat ${seat.row}-${seat.number} (${seat.category}) is already sold`),
        { statusCode: 409 }
      );
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
  const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const newOrder: DemoOrder = {
    id: orderId,
    tenant_id,
    user_id,
    event_id,
    amount: totalAmount,
    status: 'pending',
    idempotency_key,
    payment_gateway: payment_gateway || 'Midtrans',
    gateway_ref: '',
    created_at: new Date().toISOString(),
    seat_ids,
  };

  dataStore.orders.push(newOrder);

  // ── Midtrans Snap integration ────────────────────────────────────────────
  let snapToken = '';
  let snapRedirectUrl = '';
  let gatewayError: string | undefined;
  let gatewayLabel: string;

  if (isMidtransConfigured()) {
    try {
      const snapResult = await createMidtransSnapToken({
        orderId,
        grossAmount: totalAmount,
        customerName: customer_name || 'Customer',
        customerEmail: customer_email || 'customer@example.com',
        itemDetails,
      });
      snapToken = snapResult.token;
      snapRedirectUrl = snapResult.redirect_url;
      newOrder.gateway_ref = `SNAP-${orderId}`;
      gatewayLabel = 'midtrans_sandbox';
      logger.info(`[PaymentService] Midtrans Snap token created for order ${orderId}`);
    } catch (err) {
      gatewayError = (err as Error).message;
      logger.warn(`[PaymentService] Midtrans Snap failed: ${gatewayError} — falling back to simulation`);
    }
  }

  // Dev/fallback simulation
  if (!snapToken) {
    snapToken = `sim-${Buffer.from(orderId).toString('base64url')}`;
    snapRedirectUrl = buildSimulationUrl(orderId, totalAmount);
    newOrder.gateway_ref = `SIM-${orderId}`;
    gatewayLabel = 'simulation';
  }

  return {
    order: newOrder,
    snap_token: snapToken,
    redirect_url: snapRedirectUrl,
    amount: totalAmount,
    currency: 'IDR',
    gateway: gatewayLabel!,
    expires_at: new Date(Date.now() + ORDER_EXPIRY_MS).toISOString(),
    event_name: event?.name || event_id,
    supported_methods: ['credit_card', 'gopay', 'shopeepay', 'qris', 'bank_transfer'],
    ...(gatewayError && { gateway_warning: `Midtrans unavailable: ${gatewayError}` }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// issueTicketsForOrder — idempotent ticket issuance (SKILLS.md § Skill 2)
// Used by both processPaymentService (simulation) and processWebhookService (real gateway).
// Skips seats that already have a ticket for this order (re-entrant safe).
// ─────────────────────────────────────────────────────────────────────────────
export async function issueTicketsForOrder(
  orderId: string,
  userId: string,
  tenantId: string
): Promise<DemoTicket[]> {
  const order = dataStore.orders.find((o) => o.id === orderId);
  if (!order) return [];

  const issuedTickets: DemoTicket[] = [];

  for (const seatId of order.seat_ids) {
    // Idempotent: skip if ticket already issued for this seat+order
    const existing = dataStore.tickets.find(
      (t) => t.seat_id === seatId && t.order_id === orderId
    );
    if (existing) {
      issuedTickets.push(existing);
      continue;
    }

    const seat = dataStore.seats.find((s) => s.id === seatId);
    if (!seat) continue;

    // FASE 4 pattern: Release Redis lock → convert lock → sold
    const lockKey = seatLockKey(seatId);
    if (isRedisReady()) {
      if (seat.locked_by_user_id === userId) {
        await releaseLock(lockKey, userId).catch(() => {});
      } else {
        await redis.del(lockKey).catch(() => {}); // admin force-release
      }
    }

    // Update seat status
    seat.status = 'sold';
    seat.locked_until = undefined;
    seat.locked_by_user_id = undefined;

    // Generate qr_seed per ticket (SKILLS.md § Skill 3)
    const qrSeed = crypto.randomBytes(16).toString('hex');
    const ticketId = `tkt-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;

    const ticket: DemoTicket = {
      id: ticketId,
      event_id: order.event_id,
      seat_id: seat.id,
      user_id: userId,
      order_id: orderId,
      qr_seed: qrSeed,
      seat_name: `${seat.row}-${seat.number}`,
      category: seat.category,
      price: seat.price,
      status: 'valid',
      issued_at: new Date().toISOString(),
    };

    dataStore.tickets.push(ticket);
    issuedTickets.push(ticket);

    // Publish ticket.issued per ticket to RabbitMQ → notification consumer
    publishEvent(
      'ticket.issued',
      {
        ticket_id: ticket.id,
        order_id: orderId,
        event_id: order.event_id,
        seat_id: seat.id,
        seat_name: ticket.seat_name,
        category: ticket.category,
        user_id: userId,
        qr_seed: qrSeed,
        issued_at: ticket.issued_at,
      },
      tenantId
    ).catch((err) => logger.warn('[PaymentService] Failed to publish ticket.issued', err));
  }

  return issuedTickets;
}

// ─────────────────────────────────────────────────────────────────────────────
// processPaymentService — Simulation / dev mode payment processing
// ─────────────────────────────────────────────────────────────────────────────
export async function processPaymentService(
  orderId: string,
  userId: string,
  tenantId: string,
  userRole: string
): Promise<{ order: DemoOrder; tickets: DemoTicket[] }> {
  const order = dataStore.orders.find((o) => o.id === orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  // Idempotent: already paid
  if (order.status === 'paid') {
    const existingTickets = dataStore.tickets.filter((t) => t.order_id === orderId);
    return { order, tickets: existingTickets };
  }

  if (order.status === 'failed' || order.status === 'expired') {
    throw Object.assign(
      new Error(`Order cannot be paid — status is '${order.status}'`),
      { statusCode: 409 }
    );
  }

  if (order.user_id !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
    throw Object.assign(new Error('You are not authorized to pay this order'), { statusCode: 403 });
  }

  // Mark as paid
  order.status = 'paid';
  if (!order.gateway_ref || order.gateway_ref.startsWith('SIM-')) {
    order.gateway_ref = `SIM-PAID-${Date.now()}`;
  }

  // Issue tickets
  const issuedTickets = await issueTicketsForOrder(orderId, userId, tenantId);

  // Publish order.paid to RabbitMQ → notification + analytics consumers
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
  ).catch((err) => logger.warn('[PaymentService] Failed to publish order.paid', err));

  // Broadcast seat sold to seat map via Socket.IO
  io.to(`event:${order.event_id}`).emit('order_paid', {
    order_id: order.id,
    event_id: order.event_id,
    seat_ids: order.seat_ids,
  });

  logger.info(
    `[PaymentService] Simulation payment processed for order ${orderId} — ` +
    `${issuedTickets.length} ticket(s) issued`
  );

  return { order, tickets: issuedTickets };
}

// ─────────────────────────────────────────────────────────────────────────────
// Midtrans status mapping helper
// ─────────────────────────────────────────────────────────────────────────────
type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired';

export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string
): { newStatus: OrderStatus; shouldIssueTickets: boolean } {
  if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
    if (fraudStatus === 'deny') {
      return { newStatus: 'failed', shouldIssueTickets: false };
    }
    return { newStatus: 'paid', shouldIssueTickets: true };
  }
  if (transactionStatus === 'pending') {
    return { newStatus: 'pending', shouldIssueTickets: false };
  }
  if (
    transactionStatus === 'deny' ||
    transactionStatus === 'cancel' ||
    transactionStatus === 'refund' ||
    transactionStatus === 'partial_refund'
  ) {
    return { newStatus: 'failed', shouldIssueTickets: false };
  }
  if (transactionStatus === 'expire') {
    return { newStatus: 'expired', shouldIssueTickets: false };
  }
  // Unknown status — do not change
  return { newStatus: 'pending', shouldIssueTickets: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// processWebhookService — Midtrans webhook handler (SKILLS.md § Skill 2)
// ─────────────────────────────────────────────────────────────────────────────
export interface MidtransWebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
}

export async function processWebhookService(
  payload: MidtransWebhookPayload
): Promise<WebhookProcessResult> {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    transaction_id,
    payment_type,
  } = payload;

  // ── 1. Signature verification (SKILLS.md § Skill 2) ─────────────────────
  if (isMidtransConfigured()) {
    const valid = verifyMidtransSignature({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    });
    if (!valid) {
      logger.warn(`[PaymentService/Webhook] Invalid signature for order ${order_id}`);
      throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 401 });
    }
  } else {
    logger.debug('[PaymentService/Webhook] Dev mode — skipping Midtrans signature check');
  }

  // ── 2. Locate order ──────────────────────────────────────────────────────
  const order = dataStore.orders.find((o) => o.id === order_id);
  if (!order) {
    logger.warn(`[PaymentService/Webhook] Order not found: ${order_id}`);
    // Return 200 to prevent Midtrans retry loop on unknown order
    return { order_id, new_status: 'not_found', tickets_issued: 0, skipped: true };
  }

  // ── 3. Idempotency via gateway_ref (SKILLS.md § Skill 2) ────────────────
  if (transaction_id && order.gateway_ref === transaction_id && order.status === 'paid') {
    logger.info(`[PaymentService/Webhook] Duplicate webhook for txn ${transaction_id} — ignored`);
    return { order_id, new_status: order.status, tickets_issued: 0, skipped: true };
  }

  // ── 4. Map Midtrans status → internal status ─────────────────────────────
  const { newStatus, shouldIssueTickets } = mapMidtransStatus(transaction_status, fraud_status);

  logger.info(
    `[PaymentService/Webhook] Order ${order_id}: ${order.status} → ${newStatus} ` +
    `(txn_status=${transaction_status}, fraud=${fraud_status || 'n/a'}, method=${payment_type || 'n/a'})`
  );

  order.status = newStatus;
  if (transaction_id) {
    order.gateway_ref = transaction_id;
  }

  // ── 5. Issue tickets if paid ─────────────────────────────────────────────
  let ticketsIssued = 0;
  if (shouldIssueTickets) {
    const tenantId = order.tenant_id || 'tenant-001';
    const issuedTickets = await issueTicketsForOrder(order_id, order.user_id, tenantId);
    ticketsIssued = issuedTickets.length;

    // Publish order.paid → notification + analytics consumers
    publishEvent(
      'order.paid',
      {
        order_id: order.id,
        event_id: order.event_id,
        user_id: order.user_id,
        amount: order.amount,
        seat_ids: order.seat_ids,
        ticket_count: ticketsIssued,
        payment_gateway: payment_type || 'midtrans',
        transaction_id,
      },
      tenantId
    ).catch((err) => logger.error('[PaymentService/Webhook] Failed to publish order.paid', err));

    // Broadcast seat sold to seat map
    io.to(`event:${order.event_id}`).emit('order_paid', {
      order_id: order.id,
      event_id: order.event_id,
      seat_ids: order.seat_ids,
    });

    logger.info(`[PaymentService/Webhook] Issued ${ticketsIssued} ticket(s) for order ${order_id}`);
  }

  return { order_id, new_status: newStatus, tickets_issued: ticketsIssued, skipped: false };
}
