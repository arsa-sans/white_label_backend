/**
 * src/queue/consumers/notification.consumer.ts
 * Subscribes to order.paid, ticket.issued, wallet.topup, refund.processed events.
 * Implemented in Phase 9.
 */
import { getChannel, EXCHANGE } from '../../config/rabbitmq';
import { logger } from '../../utils/logger';

const QUEUE_NAME = 'notification.service';
const ROUTING_KEYS = ['order.paid', 'ticket.issued', 'wallet.topup', 'refund.processed'];

export async function startNotificationConsumer(): Promise<void> {
  const channel = getChannel();
  if (!channel) {
    logger.warn('[Consumer:notification] No RabbitMQ channel — consumer not started');
    return;
  }

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  for (const key of ROUTING_KEYS) {
    await channel.bindQueue(QUEUE_NAME, EXCHANGE, key);
  }

  channel.consume(QUEUE_NAME, (msg) => {
    if (!msg) return;
    // TODO: Fase 9 — implement notification dispatch
    logger.debug('[Consumer:notification] Received message (stub)', {
      routingKey: msg.fields.routingKey,
    });
    channel.ack(msg);
  });

  logger.info('[Consumer:notification] Started (stub)');
}
