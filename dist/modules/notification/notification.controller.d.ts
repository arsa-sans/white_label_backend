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
export declare const notificationStore: NotificationItem[];
export declare function dispatchNotification(params: {
    userId: string;
    tenantId: string;
    title: string;
    message: string;
    type: 'email' | 'whatsapp' | 'push' | 'in_app';
    metadata?: any;
}): NotificationItem;
export declare function getMyNotifications(req: Request, res: Response): Promise<void>;
export declare function sendNotification(req: Request, res: Response): Promise<void>;
export declare function markAsRead(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=notification.controller.d.ts.map