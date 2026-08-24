import { adminService } from '../admin.service';
import { dataStore } from '../../../database/dataStore';

describe('Super Admin Platform Service', () => {
  it('should get platform overview stats successfully', () => {
    const stats = adminService.getPlatformStats();
    expect(stats).toBeDefined();
    expect(stats.total_tenants).toBeGreaterThan(0);
    expect(stats.total_events).toBeGreaterThan(0);
    expect(stats.total_revenue).toBeGreaterThanOrEqual(0);
    expect(stats.recent_global_orders).toBeInstanceOf(Array);
  });

  it('should list all white label tenants with active events count', () => {
    const tenants = adminService.listTenants();
    expect(tenants.length).toBeGreaterThan(0);
    expect(tenants[0].subdomain).toBeDefined();
    expect(typeof tenants[0].active_events_count).toBe('number');
  });

  it('should create new white label tenant and create audit log', () => {
    const subdomain = `fest-${Date.now()}`;
    const created = adminService.createTenant(
      {
        name: 'Jakarta Music Week',
        subdomain,
        primary_color: '#EC4899',
      },
      'admin@demo.wl'
    );

    expect(created.id).toMatch(/^tenant-/);
    expect(created.name).toBe('Jakarta Music Week');

    // Verify audit log recorded
    const logs = adminService.listAuditLogs();
    const matchLog = logs.find((l) => l.target_id === created.id);
    expect(matchLog).toBeDefined();
    expect(matchLog?.action).toBe('TENANT_CREATED');
  });

  it('should approve organizer and log the action', () => {
    // Find or seed an organizer
    let organizer = dataStore.users.find((u) => u.role === 'organizer');
    if (!organizer) {
      organizer = {
        id: 'usr-org-test',
        tenant_id: 'tenant-001',
        name: 'Test Organizer Corp',
        email: 'testorg@demo.wl',
        password_hash: 'hash',
        role: 'organizer',
        approval_status: 'pending',
      };
      dataStore.users.push(organizer);
    }

    const reviewed = adminService.reviewOrganizer(
      organizer.id,
      { approval_status: 'approved' },
      'admin@demo.wl'
    );

    expect(reviewed.approval_status).toBe('approved');

    const logs = adminService.listAuditLogs();
    const log = logs.find((l) => l.target_id === organizer!.id);
    expect(log).toBeDefined();
    expect(log?.action).toBe('ORGANIZER_APPROVED');
  });
});
