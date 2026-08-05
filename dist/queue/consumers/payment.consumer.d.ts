/**
 * src/queue/consumers/payment.consumer.ts
 *
 * FASE 5 — Payment RabbitMQ Consumer
 *
 * Subscribes to:
 *   - order.paid      → trigger analytics update + audit log
 *   - ticket.issued   → log QR seed generation (sudah di-handle di payment.service, ini untuk audit)
 *
 * Sesuai SKILLS.md § Skill 2: consumer ini memastikan downstream effects dari payment
 * diproses async dan terpisah dari HTTP request cycle (tidak blocking checkout response).
 *
 * Alur event setelah payment berhasil:
 *   Payment API ──publishes──▶ order.paid ──consumes──▶ [notification.consumer, payment.consumer]
 *                              ticket.issued ──consumes──▶ [notification.consumer, payment.consumer]
 */
export declare function startPaymentConsumer(): Promise<void>;
//# sourceMappingURL=payment.consumer.d.ts.map