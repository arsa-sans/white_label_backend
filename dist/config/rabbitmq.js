"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCHANGE = void 0;
exports.connectRabbitMQ = connectRabbitMQ;
exports.getChannel = getChannel;
const amqplib_1 = __importDefault(require("amqplib"));
const env_1 = require("./env");
let connection = null;
let channel = null;
const EXCHANGE = 'whitelabel.events';
exports.EXCHANGE = EXCHANGE;
async function connectRabbitMQ() {
    try {
        connection = await amqplib_1.default.connect(env_1.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        connection.on('error', (err) => {
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
    }
    catch (err) {
        console.warn('[RabbitMQ] Could not connect (non-fatal in dev):', err.message);
    }
}
function getChannel() {
    return channel;
}
//# sourceMappingURL=rabbitmq.js.map