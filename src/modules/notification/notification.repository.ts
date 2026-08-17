import { NotificationItem } from './notification.types';

export class NotificationRepository {
  private store: NotificationItem[] = [
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

  public findByUserId(userId: string): NotificationItem[] {
    return this.store.filter((n) => n.user_id === userId || n.user_id === 'all');
  }

  public findById(id: string): NotificationItem | undefined {
    return this.store.find((n) => n.id === id);
  }

  public add(item: NotificationItem): void {
    this.store.unshift(item);
  }

  public markAsRead(id: string): boolean {
    const notif = this.findById(id);
    if (!notif) return false;
    notif.read = true;
    return true;
  }
}

export const notificationRepository = new NotificationRepository();
