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
export {};
//# sourceMappingURL=payment.service.test.d.ts.map