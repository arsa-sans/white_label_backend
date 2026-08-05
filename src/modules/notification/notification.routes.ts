/**
 * src/modules/notification/notification.routes.ts
 *
 * FASE 9 — Notification Service routes
 *
 * Endpoints:
 *   GET  /notifications/my       — daftar notifikasi user login
 *   POST /notifications/send     — manual broadcast notifikasi (organizer/admin)
 *   PUT  /notifications/:id/read — tandai notifikasi dibaca
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  getMyNotifications,
  sendNotification,
  markAsRead,
} from './notification.controller';

const router = Router();

router.get('/my', authenticate, getMyNotifications);
router.post('/send', authenticate, requireRole(['organizer', 'admin', 'superadmin']), sendNotification);
router.put('/:id/read', authenticate, markAsRead);

export default router;
