"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const rabbitmq_1 = require("./config/rabbitmq");
const logger_1 = require("./utils/logger");
const server = http_1.default.createServer(app_1.default);
// Socket.IO Server initialization for real-time virtual queue & seat lock updates
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: env_1.env.CORS_ORIGIN,
        credentials: true,
    },
});
exports.io.on('connection', (socket) => {
    logger_1.logger.info(`[Socket.IO] Client connected: ${socket.id}`);
    socket.on('join_event_room', (eventId) => {
        socket.join(`event:${eventId}`);
        logger_1.logger.debug(`[Socket.IO] Socket ${socket.id} joined event:${eventId}`);
    });
    socket.on('disconnect', () => {
        logger_1.logger.debug(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
});
async function startServer() {
    try {
        // 1. Connect Database
        await (0, db_1.connectDB)().catch((err) => {
            logger_1.logger.error('[DB] Connection failed', err.message);
        });
        // 2. Connect Redis
        await (0, redis_1.connectRedis)().catch((err) => {
            logger_1.logger.error('[Redis] Connection failed (non-fatal in dev)', err.message);
        });
        // 3. Connect RabbitMQ
        await (0, rabbitmq_1.connectRabbitMQ)().catch((err) => {
            logger_1.logger.error('[RabbitMQ] Connection failed (non-fatal in dev)', err.message);
        });
        // 4. Start HTTP & WebSocket Server
        server.listen(env_1.env.PORT, () => {
            logger_1.logger.info(`[Server] White Label Backend running on http://localhost:${env_1.env.PORT}`);
            logger_1.logger.info(`[Server] Environment: ${env_1.env.NODE_ENV}`);
        });
    }
    catch (err) {
        logger_1.logger.error('[Server] Fatal startup failure', err);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map