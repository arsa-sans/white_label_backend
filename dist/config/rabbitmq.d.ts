import { Channel } from 'amqplib';
declare const EXCHANGE = "whitelabel.events";
export declare function connectRabbitMQ(): Promise<void>;
export declare function getChannel(): Channel | null;
export { EXCHANGE };
//# sourceMappingURL=rabbitmq.d.ts.map