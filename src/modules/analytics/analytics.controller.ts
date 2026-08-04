import { Request, Response } from 'express';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';

export async function getDashboardMetrics(_req: Request, res: Response): Promise<void> {
  const totalEvents = dataStore.events.length;
  const totalOrders = dataStore.orders.filter((o) => o.status === 'paid');

  const totalRevenue = totalOrders.reduce((sum, o) => sum + o.amount, 0);
  const totalTicketsSold = dataStore.tickets.length;
  const totalScanned = dataStore.tickets.filter((t) => t.status === 'used').length;

  const totalSeatsCount = dataStore.seats.length;
  const soldSeatsCount = dataStore.seats.filter((s) => s.status === 'sold').length;

  const occupancyRate = totalSeatsCount > 0 ? ((soldSeatsCount / totalSeatsCount) * 100).toFixed(1) : 0;
  const checkinRate = totalTicketsSold > 0 ? ((totalScanned / totalTicketsSold) * 100).toFixed(1) : 0;

  res.json(
    ApiResponse.success(
      {
        total_revenue: totalRevenue,
        total_tickets_sold: totalTicketsSold,
        total_events: totalEvents,
        total_scanned: totalScanned,
        occupancy_rate_percent: Number(occupancyRate),
        checkin_rate_percent: Number(checkinRate),
        recent_orders: dataStore.orders.slice(-5).reverse(),
        gate_scan_logs_recent: dataStore.gateScanLogs.slice(-5).reverse(),
      },
      'Organizer dashboard metrics retrieved'
    )
  );
}
