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
import { getChannel, EXCHANGE } from '../config/rabbitmq';
import { logger } from '../utils/logger';

export interface DomainEvent<T = unknown> {
  eventType: string;
  tenantId: string;
  payload: T;
  timestamp: string;
}

export async function publishEvent<T>(
  routingKey: string,
  payload: T,
  tenantId: string
): Promise<boolean> {
  const channel = getChannel();

  if (!channel) {
    logger.warn('[Queue] Cannot publish — no RabbitMQ channel available', { routingKey });
    return false;
  }

  const message: DomainEvent<T> = {
    eventType: routingKey,
    tenantId,
    payload,
    timestamp: new Date().toISOString(),
  };

  try {
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,        // survive RabbitMQ restart
        contentType: 'application/json',
      }
    );
    logger.debug('[Queue] Published event', { routingKey, tenantId });
    return true;
  } catch (err) {
    logger.error('[Queue] Failed to publish event', { routingKey, err });
    return false;
  }
}
