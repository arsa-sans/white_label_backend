"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotificationConsumer = startNotificationConsumer;
/**
 * src/queue/consumers/notification.consumer.ts
 * Subscribes to order.paid, ticket.issued, wallet.topup, refund.processed events.
 * Implemented in Phase 9.
 */
const rabbitmq_1 = require("../../config/rabbitmq");
const logger_1 = require("../../utils/logger");
const QUEUE_NAME = 'notification.service';
const ROUTING_KEYS = ['order.paid', 'ticket.issued', 'wallet.topup', 'refund.processed'];
async function startNotificationConsumer() {
    const channel = (0, rabbitmq_1.getChannel)();
    if (!channel) {
        logger_1.logger.warn('[Consumer:notification] No RabbitMQ channel — consumer not started');
        return;
    }
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    for (const key of ROUTING_KEYS) {
        await channel.bindQueue(QUEUE_NAME, rabbitmq_1.EXCHANGE, key);
    }
    channel.consume(QUEUE_NAME, (msg) => {
        if (!msg)
            return;
        // TODO: Fase 9 — implement notification dispatch
        logger_1.logger.debug('[Consumer:notification] Received message (stub)', {
            routingKey: msg.fields.routingKey,
        });
        channel.ack(msg);
    });
    logger_1.logger.info('[Consumer:notification] Started (stub)');
}
//# sourceMappingURL=notification.consumer.js.map