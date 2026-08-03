"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishEvent = publishEvent;
/**
 * src/queue/publisher.ts
 * RabbitMQ publisher helper.
 * All domain events published here — consumers in /queue/consumers/ subscribe.
 *
 * Topic routing keys:
 *   order.paid       → notification consumer, QR generator
 *   ticket.issued    → notification consumer
 *   seat.sold        → analytics consumer
 *   seat.released    → broadcast via Socket.IO (handled in ticket service)
 *   wallet.topup     → notification consumer
 *   refund.processed → notification consumer
 */
const rabbitmq_1 = require("../config/rabbitmq");
const logger_1 = require("../utils/logger");
async function publishEvent(routingKey, payload, tenantId) {
    const channel = (0, rabbitmq_1.getChannel)();
    if (!channel) {
        logger_1.logger.warn('[Queue] Cannot publish — no RabbitMQ channel available', { routingKey });
        return false;
    }
    const message = {
        eventType: routingKey,
        tenantId,
        payload,
        timestamp: new Date().toISOString(),
    };
    try {
        channel.publish(rabbitmq_1.EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), {
            persistent: true, // survive RabbitMQ restart
            contentType: 'application/json',
        });
        logger_1.logger.debug('[Queue] Published event', { routingKey, tenantId });
        return true;
    }
    catch (err) {
        logger_1.logger.error('[Queue] Failed to publish event', { routingKey, err });
        return false;
    }
}
//# sourceMappingURL=publisher.js.map