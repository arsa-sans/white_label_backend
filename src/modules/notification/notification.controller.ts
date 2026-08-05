/**
 * src/modules/notification/notification.controller.ts
 *
 * FASE 9 — Notification Service
 *
 * Dispatcher & Management endpoints:
 *   1. getMyNotifications → GET /notifications/my (list user notifications)
 *   2. sendNotification    → POST /notifications/send (manual notification broadcast by organizer/admin)
 *   3. markAsRead          → PUT /notifications/:id/read
 *   4. dispatchNotification → internal helper called by RabbitMQ consumer & controllers
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { logger } from '../../utils/logger';

export interface NotificationItem {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  message: string;
  type: 'email' | 'whatsapp' | 'push' | 'in_app';
  read: boolean;
  created_at: string;
  metadata?: any;
}

// In-Memory Notification Store (Dev mode)
export const notificationStore: NotificationItem[] = [
  {
    id: 'notif-demo-1',
    user_id: 'user-visitor-1',
    tenant_id: 'tenant-001',
    title: 'Selamat Datang di Soundwave Festival! 🎵',
    message: 'Tiket Anda sudah terbit. Pastikan membaca panduan gate check-in sebelum hadir di venue.',
    type: 'in_app',
    read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function dispatchNotification(params: {
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  type: 'email' | 'whatsapp' | 'push' | 'in_app';
  metadata?: any;
}): NotificationItem {
  const item: NotificationItem = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
    user_id: params.userId,
    tenant_id: params.tenantId,
    title: params.title,
    message: params.message,
    type: params.type,
    read: false,
    created_at: new Date().toISOString(),
    metadata: params.metadata,
  };

  notificationStore.unshift(item);

  logger.info(`[Notification] Dispatched [${params.type.toUpperCase()}] to user ${params.userId}: "${params.title}"`);
  return item;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications/my
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const userNotifs = notificationStore.filter((n) => n.user_id === userId || n.user_id === 'all');

  const unreadCount = userNotifs.filter((n) => !n.read).length;

  res.json(
    ApiResponse.success(
      {
        notifications: userNotifs,
        unread_count: unreadCount,
      },
      'User notifications retrieved'
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/send
// Body: { target_user_id?, title, message, type? }
// Auth: requireRole(['organizer', 'admin', 'superadmin'])
// ─────────────────────────────────────────────────────────────────────────────
export async function sendNotification(req: Request, res: Response): Promise<void> {
  const { target_user_id = 'all', title, message, type = 'in_app', metadata } = req.body;

  if (!title || !message) {
    res.status(400).json(ApiResponse.error('title and message are required', 400));
    return;
  }

  const notif = dispatchNotification({
    userId: target_user_id,
    tenantId: req.user?.tenantId || 'tenant-001',
    title,
    message,
    type,
    metadata,
  });

  res.json(
    ApiResponse.success(notif, 'Notification dispatched successfully')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /notifications/:id/read
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function markAsRead(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const notif = notificationStore.find((n) => n.id === id);

  if (!notif) {
    res.status(404).json(ApiResponse.error('Notification not found', 404));
    return;
  }

  notif.read = true;

  res.json(ApiResponse.success(notif, 'Notification marked as read'));
}
