/**
 * src/config/rabbitmq.ts
 * amqplib connection + channel manager.
 * Provides shared connection and a helper to get/create channels.
 *
 * Exchange topology:
 *   - whitelabel.events (topic) — for all domain events
 *     Routing keys: order.paid, ticket.issued, seat.sold, wallet.topup, refund.processed
 */
import { Channel } from 'amqplib';
declare const EXCHANGE = "whitelabel.events";
export declare function connectRabbitMQ(): Promise<void>;
export declare function getChannel(): Channel | null;
export { EXCHANGE };
//# sourceMappingURL=rabbitmq.d.ts.map