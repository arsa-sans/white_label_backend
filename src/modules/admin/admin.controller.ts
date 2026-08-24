/**
 * src/modules/admin/admin.controller.ts
 *
 * Handlers for Super Admin endpoints.
 */

import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const getPlatformStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = adminService.getPlatformStats();
  return res.json(ApiResponse.success(stats, 'Statistik platform berhasil dimuat'));
});

export const listTenants = asyncHandler(async (_req: Request, res: Response) => {
  const list = adminService.listTenants();
  return res.json(ApiResponse.success(list, 'Daftar tenant white label'));
});

export const createTenant = asyncHandler(async (req: Request, res: Response) => {
  const actorEmail = req.user?.email || 'admin@demo.wl';
  const { name, subdomain, logo_url, primary_color, secondary_color } = req.body;

  if (!name || !subdomain) {
    return res.status(400).json(
      ApiResponse.error('Nama tenant dan subdomain wajib diisi', 400)
    );
  }

  const result = adminService.createTenant(
    { name, subdomain, logo_url, primary_color, secondary_color },
    actorEmail
  );

  return res.status(201).json(
    ApiResponse.success(result, 'Tenant baru berhasil dibuat dan diinisialisasi')
  );
});

export const listOrganizers = asyncHandler(async (_req: Request, res: Response) => {
  const list = adminService.listOrganizers();
  return res.json(ApiResponse.success(list, 'Daftar permohonan dan akun organizer'));
});

export const reviewOrganizer = asyncHandler(async (req: Request, res: Response) => {
  const actorEmail = req.user?.email || 'admin@demo.wl';
  const { userId } = req.params as { userId: string };
  const { approval_status, reason } = req.body;

  if (!approval_status || (approval_status !== 'approved' && approval_status !== 'rejected')) {
    return res.status(400).json(
      ApiResponse.error("Status persetujuan harus 'approved' atau 'rejected'", 400)
    );
  }

  const result = adminService.reviewOrganizer(userId, { approval_status, reason }, actorEmail);

  return res.json(
    ApiResponse.success(
      result,
      `Status verifikasi organizer berhasil diperbarui menjadi '${approval_status}'`
    )
  );
});

export const listAuditLogs = asyncHandler(async (_req: Request, res: Response) => {
  const logs = adminService.listAuditLogs();
  return res.json(ApiResponse.success(logs, 'Daftar audit log platform'));
});
