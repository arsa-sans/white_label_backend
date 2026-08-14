/**
 * src/modules/analytics/analytics.controller.ts
 *
 * FASE 10 — Analytics & Organizer Dashboard (Tier Based)
 */

import { Request, Response } from 'express';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { logger } from '../../utils/logger';

export interface DemoPayoutRequest {
  id: string;
  tenant_id: string;
  organizer_id: string;
  event_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  requested_at: string;
  processed_at?: string;
}

// In-Memory Payout Store
export const payoutStore: DemoPayoutRequest[] = [
  {
    id: 'pay-001',
    tenant_id: 'tenant-001',
    organizer_id: 'user-organizer-001',
    event_id: 'evt-001',
    amount: 150000000,
    bank_name: 'BCA',
    account_number: '8820194821',
    account_holder: 'PT Elena Media Utama',
    status: 'paid',
    requested_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    processed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getDashboardMetrics(req: Request, res: Response): Promise<void> {
  const event_id = req.query.event_id as string | undefined;

  let events = dataStore.events;
  let tiers = dataStore.ticketTiers;
  let tickets = dataStore.tickets;
  let orders = dataStore.orders.filter((o) => o.status === 'paid');

  if (event_id) {
    events = events.filter((e) => e.id === event_id);
    tiers = tiers.filter((t) => t.event_id === event_id);
    tickets = tickets.filter((t) => t.event_id === event_id);
    orders = orders.filter((o) => o.event_id === event_id);
  }

  const totalEvents = events.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const totalTicketsSold = tickets.length;
  const totalScanned = tickets.filter((t) => t.status === 'used').length;

  const totalQuotaCount = tiers.reduce((sum, t) => sum + t.quota, 0);
  const totalSoldQuota = tiers.reduce((sum, t) => sum + t.sold, 0);

  const occupancyRate = totalQuotaCount > 0 ? Number(((totalSoldQuota / totalQuotaCount) * 100).toFixed(1)) : 0;
  const checkinRate = totalTicketsSold > 0 ? Number(((totalScanned / totalTicketsSold) * 100).toFixed(1)) : 0;

  // Category/Tier breakdown
  const categoryBreakdown = tiers.map((t) => ({
    category: t.name,
    total: t.quota,
    sold: t.sold,
    revenue: t.sold * t.price,
  }));

  res.json(
    ApiResponse.success(
      {
        total_revenue: totalRevenue,
        total_tickets_sold: totalTicketsSold,
        total_events: totalEvents,
        total_scanned: totalScanned,
        occupancy_rate_percent: occupancyRate,
        checkin_rate_percent: checkinRate,
        category_breakdown: categoryBreakdown,
        recent_orders: orders.slice(-5).reverse(),
        recent_scan_logs: dataStore.gateScanLogs.slice(-5).reverse(),
      },
      'Organizer dashboard metrics retrieved successfully'
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/occupancy
// ─────────────────────────────────────────────────────────────────────────────
export async function getOccupancyReport(req: Request, res: Response): Promise<void> {
  const event_id = (req.query.event_id as string) || 'evt-001';
  const tiers = dataStore.ticketTiers.filter((t) => t.event_id === event_id);

  const totalQuota = tiers.reduce((sum, t) => sum + t.quota, 0);
  const totalSold = tiers.reduce((sum, t) => sum + t.sold, 0);
  const availableQuota = totalQuota - totalSold;

  res.json(
    ApiResponse.success(
      {
        event_id,
        total_seats: totalQuota,
        sold_seats: totalSold,
        locked_seats: 0,
        available_seats: availableQuota,
        occupancy_percentage: totalQuota > 0 ? Number(((totalSold / totalQuota) * 100).toFixed(1)) : 0,
      },
      'Event seat/quota occupancy report retrieved'
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/gate-throughput
// ─────────────────────────────────────────────────────────────────────────────
export async function getGateThroughput(req: Request, res: Response): Promise<void> {
  const logs = dataStore.gateScanLogs;

  const hourlyMap: Record<string, number> = {};
  for (const l of logs) {
    const hourKey = l.scanned_at.substring(0, 13) + ':00';
    hourlyMap[hourKey] = (hourlyMap[hourKey] || 0) + 1;
  }

  const chartData = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }));

  res.json(
    ApiResponse.success(
      {
        total_scans: logs.length,
        throughput_hourly: chartData,
      },
      'Gate throughput analytics retrieved'
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /analytics/payouts/request
// ─────────────────────────────────────────────────────────────────────────────
export async function requestPayout(req: Request, res: Response): Promise<void> {
  const { event_id, amount, bank_name, account_number, account_holder } = req.body;
  const organizerId = req.user?.userId;

  if (!event_id || !amount || typeof amount !== 'number' || amount <= 0 || !bank_name || !account_number || !account_holder) {
    res.status(400).json(
      ApiResponse.error('event_id, positive amount, bank_name, account_number, and account_holder are required', 400)
    );
    return;
  }

  const eventOrders = dataStore.orders.filter((o) => o.event_id === event_id && o.status === 'paid');
  const totalRevenue = eventOrders.reduce((sum, o) => sum + o.amount, 0);

  const existingPayouts = payoutStore.filter(
    (p) => p.event_id === event_id && (p.status === 'requested' || p.status === 'approved' || p.status === 'paid')
  );
  const alreadyRequestedAmount = existingPayouts.reduce((sum, p) => sum + p.amount, 0);

  const availablePayoutBalance = totalRevenue - alreadyRequestedAmount;

  if (amount > availablePayoutBalance) {
    res.status(400).json(
      ApiResponse.error(
        `Requested amount Rp ${amount.toLocaleString('id-ID')} exceeds available payout balance Rp ${availablePayoutBalance.toLocaleString('id-ID')}`,
        400
      )
    );
    return;
  }

  const payoutReq: DemoPayoutRequest = {
    id: `pay-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
    tenant_id: req.user?.tenantId || 'tenant-001',
    organizer_id: organizerId!,
    event_id,
    amount,
    bank_name,
    account_number,
    account_holder,
    status: 'requested',
    requested_at: new Date().toISOString(),
  };

  payoutStore.unshift(payoutReq);

  logger.info(
    `[Analytics/Payout] Organizer ${organizerId} requested payout of Rp ${amount} for event ${event_id}`
  );

  res.status(201).json(
    ApiResponse.success(payoutReq, 'Payout request submitted successfully. Awaiting platform admin review.')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/payouts
// ─────────────────────────────────────────────────────────────────────────────
export async function getPayouts(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const role = req.user?.role;

  let payouts = payoutStore;
  if (role === 'organizer') {
    payouts = payouts.filter((p) => p.organizer_id === userId);
  }

  res.json(ApiResponse.success(payouts, 'Payout requests retrieved'));
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /analytics/payouts/:id/status
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePayoutStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'paid', 'rejected'].includes(status)) {
    res.status(400).json(ApiResponse.error("Status must be 'approved', 'paid', or 'rejected'", 400));
    return;
  }

  const payout = payoutStore.find((p) => p.id === id);
  if (!payout) {
    res.status(404).json(ApiResponse.error('Payout request not found', 404));
    return;
  }

  payout.status = status;
  if (status === 'paid') {
    payout.processed_at = new Date().toISOString();
  }

  logger.info(`[Analytics/Payout] Payout ${id} status updated to '${status}' by admin ${req.user?.userId}`);

  res.json(
    ApiResponse.success(payout, `Payout status updated to '${status}' successfully`)
  );
}
