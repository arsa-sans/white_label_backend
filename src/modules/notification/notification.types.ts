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

export interface DispatchNotificationDto {
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  type: 'email' | 'whatsapp' | 'push' | 'in_app';
  metadata?: any;
}
