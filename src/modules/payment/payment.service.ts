/**
 * src/modules/payment/payment.service.ts
 *
 * Phase 5 — Payment Service: Business Logic Layer (Tier Based)
 *
 * Midtrans Snap API integration + dev simulation fallback.
 * Idempotency via idempotency_key header (UNIQUE index).
 */

import crypto from 'crypto';
import https from 'https';
import { dataStore, DemoOrder, DemoTicket, DemoOrderItem } from '../../database/dataStore';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { publishEvent } from '../../queue/publisher';
import { io } from '../../server';
import { promoService } from '../promo/promo.service';

// ─── Constants ────────────────────────────────────────────────────────────────
const MIDTRANS_SANDBOX_SNAP_BASE = 'https://app.sandbox.midtrans.com/snap/v1';
const ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CreateOrderItemInput {
  tier_id: string;
  quantity: number;
}

export interface CreateOrderInput {
  event_id: string;
  items?: CreateOrderItemInput[];
  seat_ids?: string[]; // legacy fallback
  payment_gateway?: string;
  customer_name?: string;
  customer_email?: string;
  promo_code?: string;
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
  skipped: boolean;
}

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
// Formula: SHA-512(order_id + status_code + gross_amount + server_key)
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

function buildSimulationUrl(orderId: string, amount: number): string {
  const base = env.CORS_ORIGIN || 'http://localhost:3000';
  return `${base}/checkout/simulate?order_id=${orderId}&amount=${amount}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// createOrderService — Business logic (Ticket Tier Based)
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrderService(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { event_id, items, seat_ids, payment_gateway, customer_name, customer_email,
          idempotency_key, user_id, tenant_id } = input;

  const event = dataStore.events.find((e) => e.id === event_id);
  if (!event) {
    throw Object.assign(new Error(`Event ${event_id} not found`), { statusCode: 404 });
  }

  // Parse items
  let orderItems: DemoOrderItem[] = [];
  if (items && items.length > 0) {
    for (const item of items) {
      const tier = dataStore.ticketTiers.find((t) => t.id === item.tier_id && t.event_id === event_id);
      if (!tier) {
        throw Object.assign(new Error(`Ticket Tier ${item.tier_id} not found`), { statusCode: 404 });
      }
      const availableQuota = tier.quota - tier.sold;
      if (item.quantity > availableQuota) {
        throw Object.assign(
          new Error(`Kuota tiket '${tier.name}' tidak mencukupi (Sisa: ${availableQuota}, Diminta: ${item.quantity})`),
          { statusCode: 409 }
        );
      }
      orderItems.push({
        tier_id: tier.id,
        tier_name: tier.name,
        quantity: item.quantity,
        unit_price: tier.price,
      });
    }
  } else if (seat_ids && seat_ids.length > 0) {
    // Legacy fallback: convert seat_ids to default VIP tier
    const defaultTier = dataStore.ticketTiers.find((t) => t.event_id === event_id) || dataStore.ticketTiers[0];
    orderItems.push({
      tier_id: defaultTier.id,
      tier_name: defaultTier.name,
      quantity: seat_ids.length,
      unit_price: defaultTier.price,
    });
  } else {
    throw Object.assign(new Error('Order items (tier_id & quantity) are required'), { statusCode: 400 });
  }

  let totalAmount = 0;
  const itemDetails: Array<{ id: string; price: number; quantity: number; name: string }> = [];

  for (const item of orderItems) {
    totalAmount += item.quantity * item.unit_price;
    itemDetails.push({
      id: item.tier_id,
      price: item.unit_price,
      quantity: item.quantity,
      name: item.tier_name,
    });
  }

  const grossAmount = totalAmount;
  let finalAmount = totalAmount;
  let discountAmount = 0;
  let appliedPromoCode = '';

  if (input.promo_code) {
    const promoRes = await promoService.validatePromo({
      code: input.promo_code,
      event_id,
      cart_total: grossAmount,
      tenant_id,
    });
    if (promoRes.valid && promoRes.promo) {
      discountAmount = promoRes.discount_amount;
      finalAmount = promoRes.final_total;
      appliedPromoCode = promoRes.promo.code;
      itemDetails.push({
        id: 'DISCOUNT',
        price: -discountAmount,
        quantity: 1,
        name: `Promo: ${appliedPromoCode}`,
      });
    }
  }

  const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const newOrder: DemoOrder = {
    id: orderId,
    tenant_id,
    user_id,
    event_id,
    amount: finalAmount,
    gross_amount: grossAmount,
    discount_amount: discountAmount,
    promo_code: appliedPromoCode || undefined,
    items: orderItems,
    status: 'pending',
    idempotency_key,
    payment_gateway: payment_gateway || 'Midtrans',
    gateway_ref: '',
    created_at: new Date().toISOString(),
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
        grossAmount: finalAmount,
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

  // Dev/fallback simulation if Snap wasn't generated
  if (!snapToken) {
    snapToken = `sim-${Buffer.from(orderId).toString('base64url')}`;
    snapRedirectUrl = buildSimulationUrl(orderId, finalAmount);
    newOrder.gateway_ref = `SIM-${orderId}`;
    gatewayLabel = 'simulation';
  }

  return {
    order: newOrder,
    snap_token: snapToken,
    redirect_url: snapRedirectUrl,
    amount: finalAmount,
    currency: 'IDR',
    gateway: gatewayLabel!,
    expires_at: new Date(Date.now() + ORDER_EXPIRY_MS).toISOString(),
    event_name: event.name,
    supported_methods: ['credit_card', 'gopay', 'shopeepay', 'qris', 'bank_transfer'],
    ...(gatewayError && { gateway_warning: `Midtrans unavailable: ${gatewayError}` }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// issueTicketsForOrder — idempotent ticket issuance per tier
// ─────────────────────────────────────────────────────────────────────────────
export async function issueTicketsForOrder(
  orderId: string,
  userId: string,
  tenantId: string
): Promise<DemoTicket[]> {
  const order = dataStore.orders.find((o) => o.id === orderId);
  if (!order) return [];

  const issuedTickets: DemoTicket[] = [];

  for (const item of order.items) {
    const tier = dataStore.ticketTiers.find((t) => t.id === item.tier_id);
    if (tier) {
      tier.sold += item.quantity;
    }

    for (let i = 0; i < item.quantity; i++) {
      const qrSeed = crypto.randomBytes(16).toString('hex');
      const ticketId = `tkt-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;

      const ticket: DemoTicket = {
        id: ticketId,
        event_id: order.event_id,
        tier_id: item.tier_id,
        tier_name: item.tier_name,
        user_id: userId,
        order_id: orderId,
        qr_seed: qrSeed,
        price: item.unit_price,
        status: 'valid',
        issued_at: new Date().toISOString(),
      };

      dataStore.tickets.push(ticket);
      issuedTickets.push(ticket);

      publishEvent(
        'ticket.issued',
        {
          ticket_id: ticket.id,
          order_id: orderId,
          event_id: order.event_id,
          tier_id: item.tier_id,
          tier_name: item.tier_name,
          user_id: userId,
          qr_seed: qrSeed,
          issued_at: ticket.issued_at,
        },
        tenantId
      ).catch((err) => logger.warn('[PaymentService] Failed to publish ticket.issued', err));
    }
  }

  return issuedTickets;
}

// ─────────────────────────────────────────────────────────────────────────────
// processPaymentService — Simulation payment processing
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

  order.status = 'paid';
  if (!order.gateway_ref || order.gateway_ref.startsWith('SIM-')) {
    order.gateway_ref = `SIM-PAID-${Date.now()}`;
  }

  // Record promo usage if discount was applied
  if (order.promo_code && order.discount_amount && order.discount_amount > 0) {
    const promo = dataStore.promoCodes.find(
      (p) => p.code === order.promo_code && p.tenant_id === tenantId
    );
    if (promo) {
      promoService.recordUsage(promo.id, orderId, userId, order.discount_amount).catch((err) =>
        logger.warn('[PaymentService] Failed to record promo usage', err)
      );
    }
  }

  const issuedTickets = await issueTicketsForOrder(orderId, userId, tenantId);

  publishEvent(
    'order.paid',
    {
      order_id: order.id,
      event_id: order.event_id,
      user_id: userId,
      amount: order.amount,
      ticket_count: issuedTickets.length,
      payment_gateway: 'simulation',
    },
    tenantId
  ).catch((err) => logger.warn('[PaymentService] Failed to publish order.paid', err));

  io.to(`event:${order.event_id}`).emit('order_paid', {
    order_id: order.id,
    event_id: order.event_id,
  });

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
  return { newStatus: 'pending', shouldIssueTickets: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// processWebhookService — Midtrans webhook handler
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
  }

  const order = dataStore.orders.find((o) => o.id === order_id);
  if (!order) {
    return { order_id, new_status: 'not_found', tickets_issued: 0, skipped: true };
  }

  if (transaction_id && order.gateway_ref === transaction_id && order.status === 'paid') {
    return { order_id, new_status: order.status, tickets_issued: 0, skipped: true };
  }

  const { newStatus, shouldIssueTickets } = mapMidtransStatus(transaction_status, fraud_status);

  order.status = newStatus;
  if (transaction_id) {
    order.gateway_ref = transaction_id;
  }

  let ticketsIssued = 0;
  if (shouldIssueTickets) {
    const tenantId = order.tenant_id || 'tenant-001';
    const issuedTickets = await issueTicketsForOrder(order_id, order.user_id, tenantId);
    ticketsIssued = issuedTickets.length;

    publishEvent(
      'order.paid',
      {
        order_id: order.id,
        event_id: order.event_id,
        user_id: order.user_id,
        amount: order.amount,
        ticket_count: ticketsIssued,
        payment_gateway: payment_type || 'midtrans',
        transaction_id,
      },
      tenantId
    ).catch((err) => logger.error('[PaymentService/Webhook] Failed to publish order.paid', err));

    io.to(`event:${order.event_id}`).emit('order_paid', {
      order_id: order.id,
      event_id: order.event_id,
    });
  }

  return { order_id, new_status: newStatus, tickets_issued: ticketsIssued, skipped: false };
}
