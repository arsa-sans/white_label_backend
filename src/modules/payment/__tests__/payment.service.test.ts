/**
 * src/modules/payment/__tests__/payment.service.test.ts
 *
 * FASE 5 — Test Suite: Payment Service (Tier Based)
 */

jest.mock('../../../config/redis', () => ({
  redis: {
    status: 'close',
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
  },
  releaseLock: jest.fn().mockResolvedValue(true),
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../config/rabbitmq', () => ({
  getChannel: jest.fn().mockReturnValue(null),
  EXCHANGE: 'test.exchange',
  connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../queue/publisher', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server', () => ({
  io: {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  },
}));

jest.mock('../../queue/queue.service', () => ({
  queueService: {
    isCheckoutSessionValid: jest.fn().mockResolvedValue({ valid: true }),
    joinQueue: jest.fn(),
    getQueueStatus: jest.fn(),
    admitQueue: jest.fn(),
  },
}));

import {
  createOrderService,
  issueTicketsForOrder,
  processPaymentService,
  verifyMidtransSignature,
  mapMidtransStatus,
  processWebhookService,
  MidtransWebhookPayload,
} from '../payment.service';
import { dataStore } from '../../../database/dataStore';
import { publishEvent } from '../../../queue/publisher';
import { env } from '../../../config/env';
import crypto from 'crypto';

function getAvailableTier(eventId = 'evt-001') {
  return dataStore.ticketTiers.find((t) => t.event_id === eventId && t.quota > t.sold)!;
}

function computeValidSignature(orderId: string, statusCode: string, grossAmount: string): string {
  const raw = `${orderId}${statusCode}${grossAmount}${env.MIDTRANS_SERVER_KEY}`;
  return crypto.createHash('sha512').update(raw).digest('hex');
}

const DEMO_USER_ID = 'user-visitor-001';
const DEMO_TENANT_ID = 'tenant-001';
const DEMO_EVENT_ID = 'evt-001';

describe('createOrderService', () => {
  test('creates order with valid ticket tier items', async () => {
    const tier = getAvailableTier();
    expect(tier).toBeDefined();

    const result = await createOrderService({
      event_id: DEMO_EVENT_ID,
      items: [{ tier_id: tier.id, quantity: 2 }],
      idempotency_key: `idemp-test-${Date.now()}`,
      user_id: DEMO_USER_ID,
      tenant_id: DEMO_TENANT_ID,
      customer_name: 'Test User',
      customer_email: 'test@example.com',
    });

    expect(result.order).toBeDefined();
    expect(result.order.status).toBe('pending');
    expect(result.order.amount).toBe(tier.price * 2);
    expect(result.snap_token).toBeTruthy();
    expect(result.currency).toBe('IDR');
  });

  test('throws 404 if tier not found in event', async () => {
    await expect(
      createOrderService({
        event_id: DEMO_EVENT_ID,
        items: [{ tier_id: 'nonexistent-tier-id', quantity: 1 }],
        idempotency_key: `idemp-404-${Date.now()}`,
        user_id: DEMO_USER_ID,
        tenant_id: DEMO_TENANT_ID,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('stores idempotency_key in new order', async () => {
    const tier = getAvailableTier();
    const key = `idemp-store-${Date.now()}`;

    const result = await createOrderService({
      event_id: DEMO_EVENT_ID,
      items: [{ tier_id: tier.id, quantity: 1 }],
      idempotency_key: key,
      user_id: DEMO_USER_ID,
      tenant_id: DEMO_TENANT_ID,
    });

    expect(result.order.idempotency_key).toBe(key);
    const stored = dataStore.orders.find((o) => o.idempotency_key === key);
    expect(stored).toBeDefined();
  });
});

describe('issueTicketsForOrder', () => {
  let testOrderId: string;
  let testTierId: string;

  beforeEach(async () => {
    const tier = getAvailableTier();
    expect(tier).toBeDefined();
    testTierId = tier.id;
    testOrderId = `ord-test-issue-${Date.now()}-${Math.random()}`;

    dataStore.tickets = dataStore.tickets.filter((t) => t.order_id !== testOrderId);

    dataStore.orders.push({
      id: testOrderId,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      event_id: DEMO_EVENT_ID,
      amount: tier.price,
      items: [{ tier_id: testTierId, tier_name: tier.name, quantity: 1, unit_price: tier.price }],
      status: 'pending',
      idempotency_key: `idemp-issue-${Date.now()}-${Math.random()}`,
      payment_gateway: 'simulation',
      gateway_ref: '',
      created_at: new Date().toISOString(),
    });
  });

  test('issues ticket and increments sold quota', async () => {
    const tickets = await issueTicketsForOrder(testOrderId, DEMO_USER_ID, DEMO_TENANT_ID);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe('valid');
    expect(tickets[0].qr_seed).toBeTruthy();
    expect(tickets[0].order_id).toBe(testOrderId);
  });
});

describe('verifyMidtransSignature', () => {
  test('returns true for valid signature', () => {
    const orderId = 'ord-test-sig-1';
    const statusCode = '200';
    const grossAmount = '150000.00';
    const sig = computeValidSignature(orderId, statusCode, grossAmount);

    const result = verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      signatureKey: sig,
    });
    expect(result).toBe(true);
  });
});

describe('mapMidtransStatus', () => {
  test('capture + accept → paid, shouldIssueTickets=true', () => {
    expect(mapMidtransStatus('capture', 'accept')).toEqual({
      newStatus: 'paid',
      shouldIssueTickets: true,
    });
  });

  test('settlement → paid, shouldIssueTickets=true', () => {
    expect(mapMidtransStatus('settlement')).toEqual({
      newStatus: 'paid',
      shouldIssueTickets: true,
    });
  });

  test('expire → expired, shouldIssueTickets=false', () => {
    expect(mapMidtransStatus('expire')).toEqual({
      newStatus: 'expired',
      shouldIssueTickets: false,
    });
  });
});
