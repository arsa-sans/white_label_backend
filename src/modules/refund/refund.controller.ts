/**
 * src/modules/refund/refund.controller.ts
 *
 * Handlers for Refund & Reschedule endpoints.
 */

import { Request, Response } from 'express';
import { refundService } from './refund.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const createRefundRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';

  if (!userId) {
    return res.status(401).json(ApiResponse.error('Unauthorized', 401));
  }

  const { order_id, ticket_id, reason } = req.body;

  if ((!order_id && !ticket_id) || !reason) {
    return res.status(400).json(
      ApiResponse.error('ID pesanan / tiket dan alasan refund wajib diisi', 400)
    );
  }

  const result = await refundService.createRefundRequest({
    order_id,
    user_id: userId,
    tenant_id: tenantId,
    ticket_id,
    type: 'refund',
    reason,
  });

  return res.status(201).json(
    ApiResponse.success(result, 'Permohonan refund berhasil diajukan dan sedang ditinjau organizer')
  );
});

export const listMyRefunds = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';

  if (!userId) {
    return res.status(401).json(ApiResponse.error('Unauthorized', 401));
  }

  const list = await refundService.listMyRefunds(userId, tenantId);
  return res.json(ApiResponse.success(list, 'Daftar permohonan refund Anda'));
});

export const listAllRefunds = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const eventId = req.query.event_id as string | undefined;

  const list = await refundService.listAllRefunds(tenantId, eventId);
  return res.json(ApiResponse.success(list, 'Daftar seluruh antrean refund'));
});

export const getRefundById = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const { id } = req.params as { id: string };

  const item = await refundService.getRefundById(id, tenantId);
  if (!item) {
    return res.status(404).json(ApiResponse.error('Permohonan refund tidak ditemukan', 404));
  }
  return res.json(ApiResponse.success(item, 'Detail permohonan refund'));
});

export const reviewRefundRequest = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const adminId = req.user?.userId;
  const { id } = req.params as { id: string };
  const { status, admin_notes, refund_amount } = req.body;

  if (!status || (status !== 'approved' && status !== 'rejected')) {
    return res.status(400).json(
      ApiResponse.error("Status review harus 'approved' atau 'rejected'", 400)
    );
  }

  const result = await refundService.reviewRefundRequest(id, tenantId, {
    status,
    admin_notes,
    refund_amount: refund_amount ? Number(refund_amount) : undefined,
    admin_id: adminId,
  });

  return res.json(
    ApiResponse.success(
      result,
      `Permohonan refund berhasil di-${status === 'approved' ? 'setujui dan diproses ke Midtrans' : 'tolak'}`
    )
  );
});
