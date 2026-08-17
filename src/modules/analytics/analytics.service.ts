import { analyticsRepository } from './analytics.repository';
import { DemoPayoutRequest, RequestPayoutDto } from './analytics.types';
import { logger } from '../../utils/logger';

export class AnalyticsService {
  public getDashboardMetrics(eventId?: string) {
    const events = analyticsRepository.getEvents(eventId);
    const tiers = analyticsRepository.getTicketTiers(eventId);
    const tickets = analyticsRepository.getTickets(eventId);
    const orders = analyticsRepository.getPaidOrders(eventId);

    const totalEvents = events.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
    const totalTicketsSold = tickets.length;
    const totalScanned = tickets.filter((t) => t.status === 'used').length;

    const totalQuotaCount = tiers.reduce((sum, t) => sum + t.quota, 0);
    const totalSoldQuota = tiers.reduce((sum, t) => sum + t.sold, 0);

    const occupancyRate = totalQuotaCount > 0 ? Number(((totalSoldQuota / totalQuotaCount) * 100).toFixed(1)) : 0;
    const checkinRate = totalTicketsSold > 0 ? Number(((totalScanned / totalTicketsSold) * 100).toFixed(1)) : 0;

    const categoryBreakdown = tiers.map((t) => ({
      category: t.name,
      total: t.quota,
      sold: t.sold,
      revenue: t.sold * t.price,
    }));

    return {
      total_revenue: totalRevenue,
      total_tickets_sold: totalTicketsSold,
      total_events: totalEvents,
      total_scanned: totalScanned,
      occupancy_rate_percent: occupancyRate,
      checkin_rate_percent: checkinRate,
      category_breakdown: categoryBreakdown,
      recent_orders: orders.slice(-5).reverse(),
      recent_scan_logs: analyticsRepository.getGateScanLogs().slice(-5).reverse(),
    };
  }

  public getOccupancyReport(eventId: string = 'evt-001') {
    const tiers = analyticsRepository.getTicketTiers(eventId);
    const totalQuota = tiers.reduce((sum, t) => sum + t.quota, 0);
    const totalSold = tiers.reduce((sum, t) => sum + t.sold, 0);
    const availableQuota = totalQuota - totalSold;

    return {
      event_id: eventId,
      total_seats: totalQuota,
      sold_seats: totalSold,
      locked_seats: 0,
      available_seats: availableQuota,
      occupancy_percentage: totalQuota > 0 ? Number(((totalSold / totalQuota) * 100).toFixed(1)) : 0,
    };
  }

  public getGateThroughput() {
    const logs = analyticsRepository.getGateScanLogs();

    const hourlyMap: Record<string, number> = {};
    for (const l of logs) {
      const hourKey = l.scanned_at.substring(0, 13) + ':00';
      hourlyMap[hourKey] = (hourlyMap[hourKey] || 0) + 1;
    }

    const chartData = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }));

    return {
      total_scans: logs.length,
      throughput_hourly: chartData,
    };
  }

  public requestPayout(
    organizerId: string,
    tenantId: string,
    dto: RequestPayoutDto
  ): { status: number; message?: string; data?: DemoPayoutRequest } {
    const { event_id, amount, bank_name, account_number, account_holder } = dto;

    const eventOrders = analyticsRepository.getPaidOrders(event_id);
    const totalRevenue = eventOrders.reduce((sum, o) => sum + o.amount, 0);

    const existingPayouts = analyticsRepository
      .getPayouts()
      .filter((p) => p.event_id === event_id && (p.status === 'requested' || p.status === 'approved' || p.status === 'paid'));
    const alreadyRequestedAmount = existingPayouts.reduce((sum, p) => sum + p.amount, 0);

    const availablePayoutBalance = totalRevenue - alreadyRequestedAmount;

    if (amount > availablePayoutBalance) {
      return {
        status: 400,
        message: `Requested amount Rp ${amount.toLocaleString('id-ID')} exceeds available payout balance Rp ${availablePayoutBalance.toLocaleString('id-ID')}`,
      };
    }

    const payoutReq: DemoPayoutRequest = {
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
      tenant_id: tenantId || 'tenant-001',
      organizer_id: organizerId,
      event_id,
      amount,
      bank_name,
      account_number,
      account_holder,
      status: 'requested',
      requested_at: new Date().toISOString(),
    };

    analyticsRepository.addPayout(payoutReq);

    logger.info(
      `[Analytics/Payout] Organizer ${organizerId} requested payout of Rp ${amount} for event ${event_id}`
    );

    return { status: 201, data: payoutReq };
  }

  public getPayouts(organizerId?: string): DemoPayoutRequest[] {
    return analyticsRepository.getPayouts(organizerId);
  }

  public updatePayoutStatus(
    id: string,
    status: 'approved' | 'paid' | 'rejected',
    adminId?: string
  ): { status: number; message?: string; data?: DemoPayoutRequest } {
    const payout = analyticsRepository.findPayoutById(id);
    if (!payout) {
      return { status: 404, message: 'Payout request not found' };
    }

    payout.status = status;
    if (status === 'paid') {
      payout.processed_at = new Date().toISOString();
    }

    logger.info(`[Analytics/Payout] Payout ${id} status updated to '${status}' by admin ${adminId}`);
    return { status: 200, data: payout };
  }
}

export const analyticsService = new AnalyticsService();
