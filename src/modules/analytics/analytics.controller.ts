/**
 * src/modules/analytics/analytics.controller.ts
 *
 * FASE 10 — Analytics & Organizer Dashboard Controller
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { analyticsService } from './analytics.service';

export async function getDashboardMetrics(req: Request, res: Response): Promise<void> {
  const event_id = req.query.event_id as string | undefined;
  const metrics = analyticsService.getDashboardMetrics(event_id);
  res.json(ApiResponse.success(metrics, 'Organizer dashboard metrics retrieved successfully'));
}

export async function getOccupancyReport(req: Request, res: Response): Promise<void> {
  const event_id = (req.query.event_id as string) || 'evt-001';
  const report = analyticsService.getOccupancyReport(event_id);
  res.json(ApiResponse.success(report, 'Event seat/quota occupancy report retrieved'));
}

export async function getGateThroughput(_req: Request, res: Response): Promise<void> {
  const throughput = analyticsService.getGateThroughput();
  res.json(ApiResponse.success(throughput, 'Gate throughput analytics retrieved'));
}

export async function requestPayout(req: Request, res: Response): Promise<void> {
  const { event_id, amount, bank_name, account_number, account_holder } = req.body;
  const organizerId = req.user?.userId;

  if (!event_id || !amount || typeof amount !== 'number' || amount <= 0 || !bank_name || !account_number || !account_holder) {
    res.status(400).json(
      ApiResponse.error('event_id, positive amount, bank_name, account_number, and account_holder are required', 400)
    );
    return;
  }

  if (!organizerId) {
    res.status(401).json(ApiResponse.error('Unauthorized', 401));
    return;
  }

  const result = analyticsService.requestPayout(organizerId, req.user?.tenantId || 'tenant-001', {
    event_id,
    amount,
    bank_name,
    account_number,
    account_holder,
  });

  if (result.status !== 201) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error requesting payout', result.status));
    return;
  }

  res.status(201).json(
    ApiResponse.success(result.data, 'Payout request submitted successfully. Awaiting platform admin review.')
  );
}

export async function getPayouts(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const role = req.user?.role;

  const payouts = analyticsService.getPayouts(role === 'organizer' ? userId : undefined);
  res.json(ApiResponse.success(payouts, 'Payout requests retrieved'));
}

export async function updatePayoutStatus(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { status } = req.body;

  if (!['approved', 'paid', 'rejected'].includes(status)) {
    res.status(400).json(ApiResponse.error("Status must be 'approved', 'paid', or 'rejected'", 400));
    return;
  }

  const adminId = typeof req.user?.userId === 'string' ? req.user.userId : undefined;
  const result = analyticsService.updatePayoutStatus(id, status, adminId);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error updating payout', result.status));
    return;
  }

  res.json(
    ApiResponse.success(result.data, `Payout status updated to '${status}' successfully`)
  );
}

import { exportService } from './export.service';

export async function exportSales(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const eventId = req.query.event_id as string | undefined;

  try {
    const buffer = await exportService.generateSalesReport(tenantId, eventId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="laporan-penjualan-tiket.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json(ApiResponse.error(error.message || 'Gagal mengekspor laporan penjualan', 500));
  }
}

export async function exportGateLogs(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const eventId = req.query.event_id as string | undefined;

  try {
    const buffer = await exportService.generateGateLogReport(tenantId, eventId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="log-gate-checkin.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json(ApiResponse.error(error.message || 'Gagal mengekspor log gate scanner', 500));
  }
}

export async function exportBoothTransactions(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const eventId = req.query.event_id as string | undefined;

  try {
    const buffer = await exportService.generateBoothTransactionReport(tenantId, eventId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="transaksi-booth-cashless.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json(ApiResponse.error(error.message || 'Gagal mengekspor transaksi booth', 500));
  }
}
