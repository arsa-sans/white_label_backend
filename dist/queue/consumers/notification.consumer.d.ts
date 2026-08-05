/**
 * src/queue/consumers/notification.consumer.ts
 *
 * FASE 9 — Notification RabbitMQ Consumer
 *
 * Subscribes to:
 *   - order.paid        → Send order confirmation email & in-app notification
 *   - ticket.issued     → Send ticket PDF link & WhatsApp QR token notification
 *   - wallet.topup      → Send wallet top-up receipt notification
 *   - refund.processed  → Send refund completion notification
 */
export declare function startNotificationConsumer(): Promise<void>;
//# sourceMappingURL=notification.consumer.d.ts.map