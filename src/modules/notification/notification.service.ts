import { notificationRepository } from './notification.repository';
import { NotificationItem, DispatchNotificationDto } from './notification.types';
import { logger } from '../../utils/logger';

export class NotificationService {
  public dispatchNotification(params: DispatchNotificationDto): NotificationItem {
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

    notificationRepository.add(item);
    logger.info(
      `[Notification] Dispatched [${params.type.toUpperCase()}] to user ${params.userId}: "${params.title}"`
    );
    return item;
  }

  public getMyNotifications(userId: string): { notifications: NotificationItem[]; unread_count: number } {
    const userNotifs = notificationRepository.findByUserId(userId);
    const unreadCount = userNotifs.filter((n) => !n.read).length;
    return {
      notifications: userNotifs,
      unread_count: unreadCount,
    };
  }

  public markAsRead(id: string): { status: number; message?: string; data?: NotificationItem } {
    const notif = notificationRepository.findById(id);
    if (!notif) {
      return { status: 404, message: 'Notification not found' };
    }
    notif.read = true;
    return { status: 200, data: notif };
  }
}

export const notificationService = new NotificationService();
