import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { connectRabbitMQ } from './config/rabbitmq';
import { logger } from './utils/logger';
import { sweepExpiredSeats } from './modules/ticket/ticket.controller';
import { startNotificationConsumer } from './queue/consumers/notification.consumer';
import { startPaymentConsumer } from './queue/consumers/payment.consumer';

const server = http.createServer(app);

// Socket.IO Server initialization for real-time virtual queue & seat lock updates
export const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('join_event_room', (eventId: string) => {
    socket.join(`event:${eventId}`);
    logger.debug(`[Socket.IO] Socket ${socket.id} joined event:${eventId}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

async function startServer() {
  try {
    // 1. Connect Database
    await connectDB().catch((err) => {
      logger.error('[DB] Connection failed', err.message);
    });

    // 2. Connect Redis
    await connectRedis().catch((err) => {
      logger.error('[Redis] Connection failed (non-fatal in dev)', err.message);
    });

    // 3. Connect RabbitMQ
    await connectRabbitMQ().catch((err) => {
      logger.error('[RabbitMQ] Connection failed (non-fatal in dev)', err.message);
    });

    // 4. Start RabbitMQ Consumers (after RabbitMQ connect attempt)
    startNotificationConsumer().catch((err) =>
      logger.warn('[Consumer] Notification consumer failed to start (non-fatal)', err)
    );
    startPaymentConsumer().catch((err) =>
      logger.warn('[Consumer] Payment consumer failed to start (non-fatal)', err)
    );

    // 5. Start HTTP & WebSocket Server
    server.listen(env.PORT, () => {
      logger.info(`[Server] White Label Backend running on http://localhost:${env.PORT}`);
      logger.info(`[Server] Environment: ${env.NODE_ENV}`);
    });

    // 6. Start cron sweeper — FASE 4 (SKILLS.md § Skill 1 point 5)
    // Checks every 60 seconds for locked seats whose TTL has expired → releases them
    const SWEEPER_INTERVAL_MS = 60 * 1000;
    setInterval(() => {
      sweepExpiredSeats().catch((err) =>
        logger.error('[Sweeper] Unexpected error in sweepExpiredSeats', err)
      );
    }, SWEEPER_INTERVAL_MS);
    logger.info(`[Sweeper] Expired seat sweeper started (interval: ${SWEEPER_INTERVAL_MS / 1000}s)`);

  } catch (err) {
    logger.error('[Server] Fatal startup failure', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

