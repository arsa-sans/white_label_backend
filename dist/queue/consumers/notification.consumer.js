"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotificationConsumer = startNotificationConsumer;
const rabbitmq_1 = require("../../config/rabbitmq");
const logger_1 = require("../../utils/logger");
const notification_controller_1 = require("../../modules/notification/notification.controller");
const QUEUE_NAME = 'notification.service';
const ROUTING_KEYS = ['order.paid', 'ticket.issued', 'wallet.topup', 'refund.processed'];
async function startNotificationConsumer() {
    const channel = (0, rabbitmq_1.getChannel)();
    if (!channel) {
        logger_1.logger.warn('[Consumer:notification] No RabbitMQ channel — consumer running in stub mode');
        return;
    }
    try {
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': `${rabbitmq_1.EXCHANGE}.dlx`,
                'x-message-ttl': 86400000,
            },
        });
        for (const key of ROUTING_KEYS) {
            await channel.bindQueue(QUEUE_NAME, rabbitmq_1.EXCHANGE, key);
        }
        channel.consume(QUEUE_NAME, (msg) => {
            if (!msg)
                return;
            const routingKey = msg.fields.routingKey;
            try {
                const event = JSON.parse(msg.content.toString());
                const { tenantId, payload } = event;
                logger_1.logger.info(`[Consumer:notification] Processing event '${routingKey}' for tenant ${tenantId}`);
                switch (routingKey) {
                    case 'order.paid':
                        (0, notification_controller_1.dispatchNotification)({
                            userId: payload.user_id,
                            tenantId,
                            title: 'Pembayaran Berhasil! 🎉',
                            message: `Pesanan #${payload.order_id} senilai Rp ${payload.amount?.toLocaleString('id-ID')} telah dikonfirmasi. Tiket Anda sedang terbit.`,
                            type: 'email',
                            metadata: payload,
                        });
                        break;
                    case 'ticket.issued':
                        (0, notification_controller_1.dispatchNotification)({
                            userId: payload.user_id,
                            tenantId,
                            title: 'Tiket Event Diterbitkan 🎟️',
                            message: `Tiket Kursi ${payload.seat_name} (${payload.category}) telah siap. Buka menu 'My Tickets' untuk mengakses Dynamic QR Code.`,
                            type: 'whatsapp',
                            metadata: payload,
                        });
                        break;
                    case 'wallet.topup':
                        (0, notification_controller_1.dispatchNotification)({
                            userId: payload.user_id,
                            tenantId,
                            title: 'Top-up Saldo Berhasil 💳',
                            message: `Saldo wallet berhasil ditambah Rp ${payload.amount?.toLocaleString('id-ID')}. Saldo terkini: Rp ${payload.new_balance?.toLocaleString('id-ID')}.`,
                            type: 'in_app',
                            metadata: payload,
                        });
                        break;
                    case 'refund.processed':
                        (0, notification_controller_1.dispatchNotification)({
                            userId: payload.user_id,
                            tenantId,
                            title: 'Pengembalian Dana Diproses 💰',
                            message: `Sisa saldo wallet sebesar Rp ${payload.amount?.toLocaleString('id-ID')} telah diproses pengembaliannya.`,
                            type: 'email',
                            metadata: payload,
                        });
                        break;
                    default:
                        logger_1.logger.debug(`[Consumer:notification] Unhandled routing key: ${routingKey}`);
                }
                channel.ack(msg);
            }
            catch (err) {
                logger_1.logger.error('[Consumer:notification] Error handling message', err);
                channel.nack(msg, false, false);
            }
        });
        logger_1.logger.info(`[Consumer:notification] Started — listening on queue '${QUEUE_NAME}'`);
    }
    catch (err) {
        logger_1.logger.error('[Consumer:notification] Failed to start consumer', err);
    }
}
//# sourceMappingURL=notification.consumer.js.map