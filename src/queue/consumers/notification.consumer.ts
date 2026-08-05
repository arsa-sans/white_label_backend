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

import { getChannel, EXCHANGE } from '../../config/rabbitmq';
import { logger } from '../../utils/logger';
import { dispatchNotification } from '../../modules/notification/notification.controller';
import type { DomainEvent } from '../publisher';

const QUEUE_NAME = 'notification.service';
const ROUTING_KEYS = ['order.paid', 'ticket.issued', 'wallet.topup', 'refund.processed'];

export async function startNotificationConsumer(): Promise<void> {
  const channel = getChannel();
  if (!channel) {
    logger.warn('[Consumer:notification] No RabbitMQ channel — consumer running in stub mode');
    return;
  }

  try {
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': `${EXCHANGE}.dlx`,
        'x-message-ttl': 86400000,
      },
    });

    for (const key of ROUTING_KEYS) {
      await channel.bindQueue(QUEUE_NAME, EXCHANGE, key);
    }

    channel.consume(QUEUE_NAME, (msg) => {
      if (!msg) return;

      const routingKey = msg.fields.routingKey;

      try {
        const event = JSON.parse(msg.content.toString()) as DomainEvent<any>;
        const { tenantId, payload } = event;

        logger.info(`[Consumer:notification] Processing event '${routingKey}' for tenant ${tenantId}`);

        switch (routingKey) {
          case 'order.paid':
            dispatchNotification({
              userId: payload.user_id,
              tenantId,
              title: 'Pembayaran Berhasil! 🎉',
              message: `Pesanan #${payload.order_id} senilai Rp ${payload.amount?.toLocaleString('id-ID')} telah dikonfirmasi. Tiket Anda sedang terbit.`,
              type: 'email',
              metadata: payload,
            });
            break;

          case 'ticket.issued':
            dispatchNotification({
              userId: payload.user_id,
              tenantId,
              title: 'Tiket Event Diterbitkan 🎟️',
              message: `Tiket Kursi ${payload.seat_name} (${payload.category}) telah siap. Buka menu 'My Tickets' untuk mengakses Dynamic QR Code.`,
              type: 'whatsapp',
              metadata: payload,
            });
            break;

          case 'wallet.topup':
            dispatchNotification({
              userId: payload.user_id,
              tenantId,
              title: 'Top-up Saldo Berhasil 💳',
              message: `Saldo wallet berhasil ditambah Rp ${payload.amount?.toLocaleString('id-ID')}. Saldo terkini: Rp ${payload.new_balance?.toLocaleString('id-ID')}.`,
              type: 'in_app',
              metadata: payload,
            });
            break;

          case 'refund.processed':
            dispatchNotification({
              userId: payload.user_id,
              tenantId,
              title: 'Pengembalian Dana Diproses 💰',
              message: `Sisa saldo wallet sebesar Rp ${payload.amount?.toLocaleString('id-ID')} telah diproses pengembaliannya.`,
              type: 'email',
              metadata: payload,
            });
            break;

          default:
            logger.debug(`[Consumer:notification] Unhandled routing key: ${routingKey}`);
        }

        channel.ack(msg);
      } catch (err) {
        logger.error('[Consumer:notification] Error handling message', err);
        channel.nack(msg, false, false);
      }
    });

    logger.info(`[Consumer:notification] Started — listening on queue '${QUEUE_NAME}'`);
  } catch (err) {
    logger.error('[Consumer:notification] Failed to start consumer', err);
  }
}
