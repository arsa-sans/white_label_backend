/**
 * src/modules/admin/admin.types.ts
 *
 * Types and DTOs for Super Admin Platform Management.
 */

export interface PlatformStats {
  total_revenue: number;
  total_tickets_sold: number;
  total_events: number;
  total_tenants: number;
  total_organizers: number;
  pending_organizer_approvals: number;
  total_visitors: number;
  recent_global_orders: any[];
}

export interface CreateTenantDto {
  name: string;
  subdomain: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface ReviewOrganizerDto {
  approval_status: 'approved' | 'rejected';
  reason?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  actor_email: string;
  actor_role: string;
  target_id?: string;
  details?: string;
}
