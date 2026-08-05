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

import { getChannel, EXCHANGE } from '../../config/rabbitmq';
import { logger } from '../../utils/logger';
import { dataStore } from '../../database/dataStore';
import type { DomainEvent } from '../publisher';

const QUEUE_NAME = 'payment.service.audit';

// Routing keys consumed by this queue
const ROUTING_KEYS = [
  'order.paid',
  'ticket.issued',
];

// ─── Payload types ────────────────────────────────────────────────────────────
interface OrderPaidPayload {
  order_id: string;
  event_id: string;
  user_id: string;
  amount: number;
  seat_ids: string[];
  ticket_count: number;
  payment_gateway: string;
  transaction_id?: string;
}

interface TicketIssuedPayload {
  ticket_id: string;
  order_id: string;
  event_id: string;
  seat_id: string;
  seat_name: string;
  category: string;
  user_id: string;
  qr_seed: string;
  issued_at: string;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
function handleOrderPaid(event: DomainEvent<OrderPaidPayload>): void {
  const { order_id, event_id, user_id, amount, ticket_count, payment_gateway } = event.payload;

  logger.info(
    `[Consumer:payment] order.paid received — order=${order_id}, ` +
    `event=${event_id}, user=${user_id}, amount=${amount}, ` +
    `tickets=${ticket_count}, gateway=${payment_gateway}`
  );

  // Audit log (dev: in-memory, prod: persist to audit_logs table)
  // In production, here you would:
  // 1. INSERT into audit_logs (actor=user_id, action='order.paid', entity='order', entity_id=order_id, meta_json=...)
  // 2. Update analytics aggregates (revenue, occupancy)
  // 3. Trigger notification worker if not using dedicated notification consumer

  // Dev: verify order exists and is marked paid
  const order = dataStore.orders.find((o) => o.id === order_id);
  if (!order) {
    logger.warn(`[Consumer:payment] order.paid — order ${order_id} not found in dataStore`);
    return;
  }
  if (order.status !== 'paid') {
    logger.warn(
      `[Consumer:payment] order.paid received but order status is '${order.status}' — ` +
      `this may be a timing issue or duplicate event`
    );
  }
}

function handleTicketIssued(event: DomainEvent<TicketIssuedPayload>): void {
  const { ticket_id, order_id, seat_name, category, user_id, issued_at } = event.payload;

  logger.info(
    `[Consumer:payment] ticket.issued received — ticket=${ticket_id}, ` +
    `order=${order_id}, seat=${seat_name} (${category}), user=${user_id}, issued_at=${issued_at}`
  );

  // In production, here you would:
  // 1. INSERT into audit_logs (action='ticket.issued', ...)
  // 2. Pre-cache ticket data in Redis for gate service lookups
  //    (key: ticket:{ticket_id}, value: { qr_seed, status, event_id })
  //    TTL: until event end_date + grace period
}

// ─── Consumer setup ───────────────────────────────────────────────────────────
export async function startPaymentConsumer(): Promise<void> {
  const channel = getChannel();
  if (!channel) {
    logger.warn('[Consumer:payment] No RabbitMQ channel available — consumer not started');
    return;
  }

  try {
    // Declare durable queue (survives RabbitMQ restart)
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        // Dead-letter exchange for failed messages (poison pill protection)
        'x-dead-letter-exchange': `${EXCHANGE}.dlx`,
        'x-message-ttl': 86400000, // 24h max TTL in queue
      },
    });

    // Bind routing keys
    for (const key of ROUTING_KEYS) {
      await channel.bindQueue(QUEUE_NAME, EXCHANGE, key);
    }

    // Process one message at a time (prefetch=1) for ordering guarantees
    channel.prefetch(1);

    channel.consume(QUEUE_NAME, (msg) => {
      if (!msg) return;

      const routingKey = msg.fields.routingKey;

      try {
        const event = JSON.parse(msg.content.toString()) as DomainEvent<unknown>;

        switch (routingKey) {
          case 'order.paid':
            handleOrderPaid(event as DomainEvent<OrderPaidPayload>);
            break;
          case 'ticket.issued':
            handleTicketIssued(event as DomainEvent<TicketIssuedPayload>);
            break;
          default:
            logger.debug(`[Consumer:payment] Unhandled routing key: ${routingKey}`);
        }

        channel.ack(msg);
      } catch (err) {
        logger.error('[Consumer:payment] Failed to process message', {
          routingKey,
          error: (err as Error).message,
        });
        // Nack with requeue=false → send to DLX for dead letter handling
        channel.nack(msg, false, false);
      }
    });

    logger.info(`[Consumer:payment] Started — listening on queue '${QUEUE_NAME}'`);
  } catch (err) {
    logger.error('[Consumer:payment] Failed to start consumer', err);
  }
}
