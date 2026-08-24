/**
 * src/modules/admin/admin.repository.ts
 *
 * Repository for Super Admin Platform operations.
 */

import { dataStore, DemoTenant, DemoUser } from '../../database/dataStore';
import { CreateTenantDto, AuditLogItem } from './admin.types';

// In-memory audit log
export const platformAuditLogs: AuditLogItem[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    action: 'ORGANIZER_APPROVED',
    actor_email: 'admin@demo.wl',
    actor_role: 'admin',
    target_id: 'user-organizer-001',
    details: 'Verifikasi identitas dan portfolio organizer Soundwave disetujui',
  },
  {
    id: 'audit-002',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    action: 'TENANT_PROVISIONED',
    actor_email: 'admin@demo.wl',
    actor_role: 'admin',
    target_id: 'tenant-001',
    details: 'Tenant Soundwave Festival berhasil diinisialisasi',
  },
];

export class AdminRepository {
  getTenants(): DemoTenant[] {
    return [...dataStore.tenants];
  }

  findTenantById(id: string): DemoTenant | undefined {
    return dataStore.tenants.find((t) => t.id === id);
  }

  findTenantBySubdomain(subdomain: string): DemoTenant | undefined {
    return dataStore.tenants.find((t) => t.subdomain.toLowerCase() === subdomain.toLowerCase());
  }

  createTenant(dto: CreateTenantDto): DemoTenant {
    const newTenant: DemoTenant = {
      id: `tenant-${Date.now().toString(36)}`,
      name: dto.name,
      subdomain: dto.subdomain,
      logo_url: dto.logo_url || '/logo.png',
      primary_color: dto.primary_color || '#4f46e5',
      secondary_color: dto.secondary_color || '#06b6d4',
    };
    dataStore.tenants.push(newTenant);
    return newTenant;
  }

  getOrganizers(): DemoUser[] {
    return dataStore.users.filter((u) => u.role === 'organizer');
  }

  findUserById(id: string): DemoUser | undefined {
    return dataStore.users.find((u) => u.id === id);
  }

  updateUserApproval(userId: string, status: 'approved' | 'rejected'): DemoUser | null {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.approval_status = status;
    return user;
  }

  getAuditLogs(): AuditLogItem[] {
    return [...platformAuditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  appendAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'>): AuditLogItem {
    const item: AuditLogItem = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    platformAuditLogs.unshift(item);
    return item;
  }
}

export const adminRepository = new AdminRepository();
