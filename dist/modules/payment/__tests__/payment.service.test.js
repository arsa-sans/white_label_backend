"use strict";
/**
 * src/modules/payment/__tests__/payment.service.test.ts
 *
 * FASE 5 — Test Suite: Payment Service
 *
 * Tests cover (SKILLS.md § Skill 2):
 *   1. createOrderService — validasi input, seat availability, idempotency key stored
 *   2. issueTicketsForOrder — idempotency (skip duplicate), qr_seed generated, seat → sold
 *   3. processPaymentService — happy path, already-paid idempotency, unauthorized, invalid status
 *   4. verifyMidtransSignature — valid/invalid signature
 *   5. mapMidtransStatus — all Midtrans transaction_status variants
 *   6. processWebhookService — paid, expired, duplicate idempotency, order-not-found
 *
 * Note: Redis & RabbitMQ calls are mocked.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ─── Mocks (must be declared before imports that use them) ────────────────────
jest.mock('../../../config/redis', () => ({
    redis: {
        status: 'close', // Simulate Redis not ready → triggers in-memory fallback
        del: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
    },
    releaseLock: jest.fn().mockResolvedValue(true),
    connectRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../config/rabbitmq', () => ({
    getChannel: jest.fn().mockReturnValue(null), // No RabbitMQ in test env
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
const payment_service_1 = require("../payment.service");
const dataStore_1 = require("../../../database/dataStore");
const publisher_1 = require("../../../queue/publisher");
const env_1 = require("../../../config/env");
const crypto_1 = __importDefault(require("crypto"));
// ─── Shared test helpers ──────────────────────────────────────────────────────
function getAvailableSeat(eventId = 'evt-001') {
    return dataStore_1.dataStore.seats.find((s) => s.event_id === eventId && s.status === 'available');
}
function computeValidSignature(orderId, statusCode, grossAmount) {
    const raw = `${orderId}${statusCode}${grossAmount}${env_1.env.MIDTRANS_SERVER_KEY}`;
    return crypto_1.default.createHash('sha512').update(raw).digest('hex');
}
const DEMO_USER_ID = 'user-visitor-1';
const DEMO_TENANT_ID = 'tenant-001';
const DEMO_EVENT_ID = 'evt-001';
// ─── 1. createOrderService ────────────────────────────────────────────────────
describe('createOrderService', () => {
    test('creates order with valid seats and returns snap_token', async () => {
        const seat = getAvailableSeat();
        expect(seat).toBeDefined();
        const result = await (0, payment_service_1.createOrderService)({
            event_id: DEMO_EVENT_ID,
            seat_ids: [seat.id],
            idempotency_key: `idemp-test-${Date.now()}`,
            user_id: DEMO_USER_ID,
            tenant_id: DEMO_TENANT_ID,
            customer_name: 'Test User',
            customer_email: 'test@example.com',
        });
        expect(result.order).toBeDefined();
        expect(result.order.status).toBe('pending');
        expect(result.order.amount).toBe(seat.price);
        expect(result.snap_token).toBeTruthy();
        expect(result.redirect_url).toContain('simulate');
        expect(result.gateway).toBe('simulation');
        expect(result.currency).toBe('IDR');
    });
    test('throws 404 if seat not found in event', async () => {
        await expect((0, payment_service_1.createOrderService)({
            event_id: DEMO_EVENT_ID,
            seat_ids: ['nonexistent-seat-id'],
            idempotency_key: `idemp-404-${Date.now()}`,
            user_id: DEMO_USER_ID,
            tenant_id: DEMO_TENANT_ID,
        })).rejects.toMatchObject({ statusCode: 404 });
    });
    test('throws 409 if seat is already sold', async () => {
        const soldSeat = dataStore_1.dataStore.seats.find((s) => s.event_id === DEMO_EVENT_ID && s.status === 'sold');
        expect(soldSeat).toBeDefined();
        await expect((0, payment_service_1.createOrderService)({
            event_id: DEMO_EVENT_ID,
            seat_ids: [soldSeat.id],
            idempotency_key: `idemp-409-${Date.now()}`,
            user_id: DEMO_USER_ID,
            tenant_id: DEMO_TENANT_ID,
        })).rejects.toMatchObject({ statusCode: 409 });
    });
    test('stores idempotency_key in new order', async () => {
        const seat = getAvailableSeat();
        const key = `idemp-store-${Date.now()}`;
        const result = await (0, payment_service_1.createOrderService)({
            event_id: DEMO_EVENT_ID,
            seat_ids: [seat.id],
            idempotency_key: key,
            user_id: DEMO_USER_ID,
            tenant_id: DEMO_TENANT_ID,
        });
        expect(result.order.idempotency_key).toBe(key);
        // Verify order persisted in dataStore
        const stored = dataStore_1.dataStore.orders.find((o) => o.idempotency_key === key);
        expect(stored).toBeDefined();
        expect(stored?.status).toBe('pending');
    });
    test('total amount is sum of all selected seat prices', async () => {
        const seats = dataStore_1.dataStore.seats
            .filter((s) => s.event_id === DEMO_EVENT_ID && s.status === 'available')
            .slice(0, 2);
        expect(seats.length).toBe(2);
        const expectedTotal = seats[0].price + seats[1].price;
        const result = await (0, payment_service_1.createOrderService)({
            event_id: DEMO_EVENT_ID,
            seat_ids: seats.map((s) => s.id),
            idempotency_key: `idemp-multi-${Date.now()}`,
            user_id: DEMO_USER_ID,
            tenant_id: DEMO_TENANT_ID,
        });
        expect(result.order.amount).toBe(expectedTotal);
        expect(result.amount).toBe(expectedTotal);
    });
});
// ─── 2. issueTicketsForOrder ──────────────────────────────────────────────────
describe('issueTicketsForOrder', () => {
    let testOrderId;
    let testSeatId;
    beforeEach(async () => {
        // Reset seat status for fresh test run
        const seat = getAvailableSeat();
        expect(seat).toBeDefined();
        testSeatId = seat.id;
        testOrderId = `ord-test-issue-${Date.now()}-${Math.random()}`;
        // Clean up any test tickets for this order
        dataStore_1.dataStore.tickets = dataStore_1.dataStore.tickets.filter((t) => t.order_id !== testOrderId);
        dataStore_1.dataStore.orders.push({
            id: testOrderId,
            tenant_id: DEMO_TENANT_ID,
            user_id: DEMO_USER_ID,
            event_id: DEMO_EVENT_ID,
            amount: seat.price,
            status: 'pending',
            idempotency_key: `idemp-issue-${Date.now()}-${Math.random()}`,
            payment_gateway: 'simulation',
            gateway_ref: '',
            created_at: new Date().toISOString(),
            seat_ids: [testSeatId],
        });
    });
    test('issues ticket and marks seat as sold', async () => {
        const tickets = await (0, payment_service_1.issueTicketsForOrder)(testOrderId, DEMO_USER_ID, DEMO_TENANT_ID);
        expect(tickets).toHaveLength(1);
        expect(tickets[0].status).toBe('valid');
        expect(tickets[0].qr_seed).toBeTruthy();
        expect(tickets[0].qr_seed).toHaveLength(32); // 16 bytes hex = 32 chars
        expect(tickets[0].order_id).toBe(testOrderId);
        const seat = dataStore_1.dataStore.seats.find((s) => s.id === testSeatId);
        expect(seat?.status).toBe('sold');
    });
    test('is idempotent — second call returns same ticket without duplicate', async () => {
        const tickets1 = await (0, payment_service_1.issueTicketsForOrder)(testOrderId, DEMO_USER_ID, DEMO_TENANT_ID);
        const tickets2 = await (0, payment_service_1.issueTicketsForOrder)(testOrderId, DEMO_USER_ID, DEMO_TENANT_ID);
        expect(tickets1).toHaveLength(1);
        expect(tickets2).toHaveLength(1);
        expect(tickets1[0].id).toBe(tickets2[0].id); // Same ticket returned
    });
    test('publishes ticket.issued event to RabbitMQ (attempt)', async () => {
        const mockPublish = publisher_1.publishEvent;
        mockPublish.mockClear();
        await (0, payment_service_1.issueTicketsForOrder)(testOrderId, DEMO_USER_ID, DEMO_TENANT_ID);
        expect(mockPublish).toHaveBeenCalledWith('ticket.issued', expect.objectContaining({
            order_id: testOrderId,
            event_id: DEMO_EVENT_ID,
            user_id: DEMO_USER_ID,
        }), DEMO_TENANT_ID);
    });
    test('returns empty array for nonexistent order', async () => {
        const tickets = await (0, payment_service_1.issueTicketsForOrder)('nonexistent-order', DEMO_USER_ID, DEMO_TENANT_ID);
        expect(tickets).toEqual([]);
    });
});
// ─── 3. processPaymentService ─────────────────────────────────────────────────
describe('processPaymentService', () => {
    let pendingOrderId;
    beforeEach(async () => {
        const seat = getAvailableSeat();
        expect(seat).toBeDefined();
        pendingOrderId = `ord-proc-${Date.now()}`;
        dataStore_1.dataStore.orders.push({
            id: pendingOrderId,
            tenant_id: DEMO_TENANT_ID,
            user_id: DEMO_USER_ID,
            event_id: DEMO_EVENT_ID,
            amount: seat.price,
            status: 'pending',
            idempotency_key: `idemp-proc-${Date.now()}`,
            payment_gateway: 'simulation',
            gateway_ref: '',
            created_at: new Date().toISOString(),
            seat_ids: [seat.id],
        });
    });
    test('successfully processes payment and issues tickets', async () => {
        const result = await (0, payment_service_1.processPaymentService)(pendingOrderId, DEMO_USER_ID, DEMO_TENANT_ID, 'visitor');
        expect(result.order.status).toBe('paid');
        expect(result.tickets.length).toBeGreaterThanOrEqual(1);
        expect(result.tickets[0].status).toBe('valid');
    });
    test('is idempotent — calling twice returns same result (no duplicate tickets)', async () => {
        const result1 = await (0, payment_service_1.processPaymentService)(pendingOrderId, DEMO_USER_ID, DEMO_TENANT_ID, 'visitor');
        const result2 = await (0, payment_service_1.processPaymentService)(pendingOrderId, DEMO_USER_ID, DEMO_TENANT_ID, 'visitor');
        expect(result1.order.status).toBe('paid');
        expect(result2.order.status).toBe('paid');
        expect(result1.tickets.length).toBe(result2.tickets.length);
        expect(result1.tickets[0].id).toBe(result2.tickets[0].id);
    });
    test('throws 404 if order not found', async () => {
        await expect((0, payment_service_1.processPaymentService)('nonexistent-order', DEMO_USER_ID, DEMO_TENANT_ID, 'visitor')).rejects.toMatchObject({ statusCode: 404 });
    });
    test('throws 403 if user is not the order owner', async () => {
        await expect((0, payment_service_1.processPaymentService)(pendingOrderId, 'other-user-id', DEMO_TENANT_ID, 'visitor')).rejects.toMatchObject({ statusCode: 403 });
    });
    test('admin can pay any order (bypasses ownership check)', async () => {
        const result = await (0, payment_service_1.processPaymentService)(pendingOrderId, 'any-admin-id', DEMO_TENANT_ID, 'admin');
        expect(result.order.status).toBe('paid');
    });
    test('throws 409 for already-failed order', async () => {
        const seat = getAvailableSeat();
        const failedOrderId = `ord-failed-${Date.now()}`;
        dataStore_1.dataStore.orders.push({
            id: failedOrderId,
            tenant_id: DEMO_TENANT_ID,
            user_id: DEMO_USER_ID,
            event_id: DEMO_EVENT_ID,
            amount: seat?.price || 100000,
            status: 'failed',
            idempotency_key: `idemp-failed-${Date.now()}`,
            payment_gateway: 'simulation',
            gateway_ref: 'FAIL',
            created_at: new Date().toISOString(),
            seat_ids: [],
        });
        await expect((0, payment_service_1.processPaymentService)(failedOrderId, DEMO_USER_ID, DEMO_TENANT_ID, 'visitor')).rejects.toMatchObject({ statusCode: 409 });
    });
    test('publishes order.paid event after successful payment', async () => {
        const mockPublish = publisher_1.publishEvent;
        mockPublish.mockClear();
        await (0, payment_service_1.processPaymentService)(pendingOrderId, DEMO_USER_ID, DEMO_TENANT_ID, 'visitor');
        expect(mockPublish).toHaveBeenCalledWith('order.paid', expect.objectContaining({
            order_id: pendingOrderId,
            user_id: DEMO_USER_ID,
            payment_gateway: 'simulation',
        }), DEMO_TENANT_ID);
    });
});
// ─── 4. verifyMidtransSignature ───────────────────────────────────────────────
describe('verifyMidtransSignature', () => {
    test('returns true for valid signature', () => {
        const orderId = 'ord-test-sig-1';
        const statusCode = '200';
        const grossAmount = '150000.00';
        const sig = computeValidSignature(orderId, statusCode, grossAmount);
        const result = (0, payment_service_1.verifyMidtransSignature)({
            orderId,
            statusCode,
            grossAmount,
            signatureKey: sig,
        });
        expect(result).toBe(true);
    });
    test('returns false for tampered signature', () => {
        const result = (0, payment_service_1.verifyMidtransSignature)({
            orderId: 'ord-test',
            statusCode: '200',
            grossAmount: '150000.00',
            signatureKey: 'a'.repeat(128), // invalid
        });
        expect(result).toBe(false);
    });
});
// ─── 5. mapMidtransStatus ─────────────────────────────────────────────────────
describe('mapMidtransStatus', () => {
    test('capture + accept → paid, shouldIssueTickets=true', () => {
        expect((0, payment_service_1.mapMidtransStatus)('capture', 'accept')).toEqual({
            newStatus: 'paid',
            shouldIssueTickets: true,
        });
    });
    test('capture + deny → failed, shouldIssueTickets=false', () => {
        expect((0, payment_service_1.mapMidtransStatus)('capture', 'deny')).toEqual({
            newStatus: 'failed',
            shouldIssueTickets: false,
        });
    });
    test('settlement → paid, shouldIssueTickets=true', () => {
        expect((0, payment_service_1.mapMidtransStatus)('settlement')).toEqual({
            newStatus: 'paid',
            shouldIssueTickets: true,
        });
    });
    test('pending → pending, shouldIssueTickets=false', () => {
        expect((0, payment_service_1.mapMidtransStatus)('pending')).toEqual({
            newStatus: 'pending',
            shouldIssueTickets: false,
        });
    });
    test('expire → expired, shouldIssueTickets=false', () => {
        expect((0, payment_service_1.mapMidtransStatus)('expire')).toEqual({
            newStatus: 'expired',
            shouldIssueTickets: false,
        });
    });
    test('deny → failed', () => {
        const { newStatus, shouldIssueTickets } = (0, payment_service_1.mapMidtransStatus)('deny');
        expect(newStatus).toBe('failed');
        expect(shouldIssueTickets).toBe(false);
    });
    test('cancel → failed', () => {
        const { newStatus } = (0, payment_service_1.mapMidtransStatus)('cancel');
        expect(newStatus).toBe('failed');
    });
    test('refund → failed', () => {
        const { newStatus } = (0, payment_service_1.mapMidtransStatus)('refund');
        expect(newStatus).toBe('failed');
    });
    test('unknown status → pending (no change)', () => {
        const { newStatus, shouldIssueTickets } = (0, payment_service_1.mapMidtransStatus)('unknown_status');
        expect(newStatus).toBe('pending');
        expect(shouldIssueTickets).toBe(false);
    });
});
// ─── 6. processWebhookService ─────────────────────────────────────────────────
describe('processWebhookService', () => {
    let webhookOrderId;
    let webhookSeatId;
    function makeWebhookPayload(overrides = {}) {
        const orderId = overrides.order_id || webhookOrderId;
        const statusCode = overrides.status_code || '200';
        const grossAmount = overrides.gross_amount || '500000';
        const sig = computeValidSignature(orderId, statusCode, grossAmount);
        return {
            order_id: orderId,
            status_code: statusCode,
            gross_amount: grossAmount,
            signature_key: sig,
            transaction_status: 'settlement',
            fraud_status: 'accept',
            transaction_id: `txn-${Date.now()}-${Math.random()}`,
            payment_type: 'qris',
            ...overrides,
        };
    }
    beforeEach(async () => {
        const seat = getAvailableSeat();
        expect(seat).toBeDefined();
        webhookSeatId = seat.id;
        webhookOrderId = `ord-wh-${Date.now()}`;
        dataStore_1.dataStore.orders.push({
            id: webhookOrderId,
            tenant_id: DEMO_TENANT_ID,
            user_id: DEMO_USER_ID,
            event_id: DEMO_EVENT_ID,
            amount: seat.price,
            status: 'pending',
            idempotency_key: `idemp-wh-${Date.now()}`,
            payment_gateway: 'Midtrans',
            gateway_ref: '',
            created_at: new Date().toISOString(),
            seat_ids: [webhookSeatId],
        });
    });
    test('processes settlement webhook — marks order paid, issues tickets', async () => {
        const result = await (0, payment_service_1.processWebhookService)(makeWebhookPayload());
        expect(result.skipped).toBe(false);
        expect(result.new_status).toBe('paid');
        expect(result.tickets_issued).toBeGreaterThanOrEqual(1);
        const order = dataStore_1.dataStore.orders.find((o) => o.id === webhookOrderId);
        expect(order?.status).toBe('paid');
    });
    test('is idempotent — duplicate webhook with same transaction_id is skipped', async () => {
        const transactionId = `txn-dup-${Date.now()}`;
        const result1 = await (0, payment_service_1.processWebhookService)(makeWebhookPayload({ transaction_id: transactionId }));
        const result2 = await (0, payment_service_1.processWebhookService)(makeWebhookPayload({ transaction_id: transactionId }));
        expect(result1.skipped).toBe(false);
        expect(result2.skipped).toBe(true); // Second call is idempotent
    });
    test('returns skipped=true for nonexistent order (avoid retry loop)', async () => {
        const result = await (0, payment_service_1.processWebhookService)(makeWebhookPayload({ order_id: 'nonexistent-order-000' }));
        expect(result.skipped).toBe(true);
        expect(result.new_status).toBe('not_found');
    });
    test('marks order expired for expire transaction_status', async () => {
        const result = await (0, payment_service_1.processWebhookService)(makeWebhookPayload({ transaction_status: 'expire', fraud_status: undefined }));
        expect(result.new_status).toBe('expired');
        expect(result.tickets_issued).toBe(0);
    });
    test('marks order failed for cancel transaction_status', async () => {
        const result = await (0, payment_service_1.processWebhookService)(makeWebhookPayload({ transaction_status: 'cancel', fraud_status: undefined }));
        expect(result.new_status).toBe('failed');
        expect(result.tickets_issued).toBe(0);
    });
    test('does not issue tickets on pending webhook', async () => {
        const result = await (0, payment_service_1.processWebhookService)(makeWebhookPayload({ transaction_status: 'pending', fraud_status: undefined }));
        expect(result.new_status).toBe('pending');
        expect(result.tickets_issued).toBe(0);
    });
});
//# sourceMappingURL=payment.service.test.js.map