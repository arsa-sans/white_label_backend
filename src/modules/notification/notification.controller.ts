/**
 * src/modules/notification/notification.controller.ts
 *
 * FASE 9 — Notification Controller
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { notificationService } from './notification.service';
import { DispatchNotificationDto, NotificationItem } from './notification.types';

export function dispatchNotification(params: DispatchNotificationDto): NotificationItem {
  return notificationService.dispatchNotification(params);
}

export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(ApiResponse.error('Unauthorized', 401));
    return;
  }

  const result = notificationService.getMyNotifications(userId);
  res.json(ApiResponse.success(result, 'User notifications retrieved'));
}

export async function sendNotification(req: Request, res: Response): Promise<void> {
  const { target_user_id = 'all', title, message, type = 'in_app', metadata } = req.body;

  if (!title || !message) {
    res.status(400).json(ApiResponse.error('title and message are required', 400));
    return;
  }

  const notif = notificationService.dispatchNotification({
    userId: target_user_id,
    tenantId: req.user?.tenantId || 'tenant-001',
    title,
    message,
    type,
    metadata,
  });

  res.json(ApiResponse.success(notif, 'Notification dispatched successfully'));
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const result = notificationService.markAsRead(id);

  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error updating notification', result.status));
    return;
  }

  res.json(ApiResponse.success(result.data, 'Notification marked as read'));
}
