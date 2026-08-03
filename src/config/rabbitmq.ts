/**
 * src/config/rabbitmq.ts
 * amqplib connection + channel manager.
 * Provides shared connection and a helper to get/create channels.
 *
 * Exchange topology:
 *   - whitelabel.events (topic) — for all domain events
 *     Routing keys: order.paid, ticket.issued, seat.sold, wallet.topup, refund.processed
 */
import amqp, { ChannelModel, Channel } from 'amqplib';
import { env } from './env';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

const EXCHANGE = 'whitelabel.events';

export async function connectRabbitMQ(): Promise<void> {
  try {
    connection = await amqp.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    connection.on('error', (err: Error) => {
      console.error('[RabbitMQ] Connection error:', err.message);
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.warn('[RabbitMQ] Connection closed, attempting reconnect in 5s...');
      connection = null;
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });

    console.log('[RabbitMQ] Connected, exchange asserted:', EXCHANGE);
  } catch (err) {
    console.warn('[RabbitMQ] Could not connect (non-fatal in dev):', (err as Error).message);
  }
}

export function getChannel(): Channel | null {
  return channel;
}

export { EXCHANGE };
