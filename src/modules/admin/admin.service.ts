/**
 * src/modules/admin/admin.service.ts
 *
 * Business logic layer for Super Admin operations.
 */

import { dataStore, DemoTenant, DemoUser } from '../../database/dataStore';
import { adminRepository, AdminRepository } from './admin.repository';
import {
  PlatformStats,
  CreateTenantDto,
  ReviewOrganizerDto,
  AuditLogItem,
} from './admin.types';
import { sendOrganizerApprovalEmail } from '../../utils/mailer';

export class AdminService {
  constructor(private repo: AdminRepository = adminRepository) {}

  public getPlatformStats(): PlatformStats {
    const totalRevenue = dataStore.orders
      .filter((o) => o.status === 'paid')
      .reduce((sum, o) => sum + o.amount, 0);

    const totalTicketsSold = dataStore.tickets.filter((t) => t.status !== 'void').length;
    const totalEvents = dataStore.events.filter((e) => e.status !== 'deleted').length;
    const totalTenants = dataStore.tenants.length;
    const organizers = dataStore.users.filter((u) => u.role === 'organizer');
    const pendingApprovals = organizers.filter((u) => u.approval_status === 'pending').length;
    const totalVisitors = dataStore.users.filter((u) => u.role === 'visitor').length;

    const recentOrders = [...dataStore.orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return {
      total_revenue: totalRevenue,
      total_tickets_sold: totalTicketsSold,
      total_events: totalEvents,
      total_tenants: totalTenants,
      total_organizers: organizers.length,
      pending_organizer_approvals: pendingApprovals,
      total_visitors: totalVisitors,
      recent_global_orders: recentOrders,
    };
  }

  public listTenants(): (DemoTenant & { active_events_count: number })[] {
    const tenants = this.repo.getTenants();
    return tenants.map((t) => {
      const activeEvents = dataStore.events.filter(
        (e) => e.tenant_id === t.id && e.status === 'published'
      ).length;
      return {
        ...t,
        active_events_count: activeEvents,
      };
    });
  }

  public createTenant(dto: CreateTenantDto, actorEmail: string): DemoTenant {
    const existing = this.repo.findTenantBySubdomain(dto.subdomain);
    if (existing) {
      throw new Error(`Subdomain "${dto.subdomain}" sudah digunakan.`);
    }

    const tenant = this.repo.createTenant(dto);

    this.repo.appendAuditLog({
      action: 'TENANT_CREATED',
      actor_email: actorEmail,
      actor_role: 'admin',
      target_id: tenant.id,
      details: `Tenant "${tenant.name}" (${tenant.subdomain}.domain) berhasil dibuat.`,
    });

    return tenant;
  }

  public listOrganizers(): DemoUser[] {
    return this.repo.getOrganizers();
  }

  public reviewOrganizer(
    userId: string,
    dto: ReviewOrganizerDto,
    actorEmail: string
  ): DemoUser {
    const user = this.repo.findUserById(userId);
    if (!user || user.role !== 'organizer') {
      throw new Error('Organizer tidak ditemukan.');
    }

    const updated = this.repo.updateUserApproval(userId, dto.approval_status);

    if (dto.approval_status === 'approved') {
      sendOrganizerApprovalEmail(user.email, user.name, user.company_name).catch(() => {});
    }

    this.repo.appendAuditLog({
      action: dto.approval_status === 'approved' ? 'ORGANIZER_APPROVED' : 'ORGANIZER_REJECTED',
      actor_email: actorEmail,
      actor_role: 'admin',
      target_id: userId,
      details: `Organizer "${user.name}" (${user.email}) di-${dto.approval_status}.${
        dto.reason ? ` Alasan: ${dto.reason}` : ''
      }`,
    });

    return updated!;
  }

  public listAuditLogs(): AuditLogItem[] {
    return this.repo.getAuditLogs();
  }
}

export const adminService = new AdminService();
