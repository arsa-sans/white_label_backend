import path from 'path';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { resolveTenant } from './middlewares/tenant.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { ApiResponse } from './utils/apiResponse';

import authRoutes from './modules/auth/auth.routes';
import eventRoutes from './modules/event/event.routes';
import ticketRoutes from './modules/ticket/ticket.routes';
import paymentRoutes from './modules/payment/payment.routes';
import cashlessRoutes from './modules/cashless/cashless.routes';
import gateRoutes from './modules/gate/gate.routes';
import notificationRoutes from './modules/notification/notification.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';

const app: Application = express();

// Security & Parsing Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman) and localhost dev origins
      const allowed = [
        env.CORS_ORIGIN,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-idempotency-key',
      'Idempotency-Key',
      'x-tenant-id',
      'x-webhook-secret',
    ],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.isDev) {
  app.use(morgan('dev'));
}

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


// Global Health Check (bypasses tenant resolution)
app.get('/health', (_req: Request, res: Response) => {
  res.json(
    ApiResponse.success(
      { status: 'online', uptime: process.uptime(), timestamp: new Date().toISOString() },
      'White Label Backend API Operational'
    )
  );
});

// Modular Monolith API Routes (Tenant resolution applied)
const apiRouter = express.Router();
apiRouter.use(resolveTenant);

apiRouter.use('/auth', authRoutes);
apiRouter.use('/events', eventRoutes);
apiRouter.use('/tickets', ticketRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/cashless', cashlessRoutes);
apiRouter.use('/gate', gateRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/analytics', analyticsRoutes);

app.use('/api/v1', apiRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
