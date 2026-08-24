/**
 * src/modules/promo/promo.controller.ts
 *
 * Controller handlers for promo codes & vouchers.
 */

import { Request, Response } from 'express';
import { promoService } from './promo.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const listPromos = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const eventId = req.query.event_id as string | undefined;

  const promos = await promoService.listPromos(tenantId, eventId);
  return res.json(ApiResponse.success(promos, 'Daftar kode promo berhasil dimuat'));
});

export const getPromoById = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const { id } = req.params as { id: string };

  const promo = await promoService.getPromoById(id, tenantId);
  if (!promo) {
    return res.status(404).json(ApiResponse.error('Kode promo tidak ditemukan', 404));
  }
  return res.json(ApiResponse.success(promo, 'Detail kode promo'));
});

export const createPromo = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const {
    code,
    type,
    value,
    max_uses,
    min_purchase,
    valid_from,
    valid_until,
    event_id,
    is_active,
  } = req.body;

  if (!code || !type || value === undefined || !valid_from || !valid_until) {
    return res.status(400).json(
      ApiResponse.error('Field code, type, value, valid_from, dan valid_until wajib diisi', 400)
    );
  }

  const promo = await promoService.createPromo({
    tenant_id: tenantId,
    event_id,
    code,
    type,
    value: Number(value),
    max_uses: max_uses !== undefined && max_uses !== '' ? Number(max_uses) : null,
    min_purchase: min_purchase ? Number(min_purchase) : 0,
    valid_from,
    valid_until,
    is_active: is_active ?? true,
  });

  return res.status(201).json(ApiResponse.success(promo, 'Kode promo berhasil dibuat'));
});

export const updatePromo = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const { id } = req.params as { id: string };

  const updated = await promoService.updatePromo(id, tenantId, req.body);
  return res.json(ApiResponse.success(updated, 'Kode promo berhasil diperbarui'));
});

export const deletePromo = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const { id } = req.params as { id: string };

  await promoService.deletePromo(id, tenantId);
  return res.json(ApiResponse.success({ id }, 'Kode promo berhasil dihapus'));
});

export const validatePromoCode = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';
  const { code, event_id, cart_total } = req.body;

  if (!code || cart_total === undefined) {
    return res.status(400).json(ApiResponse.error('Field code dan cart_total wajib disertakan', 400));
  }

  const result = await promoService.validatePromo({
    code,
    event_id: event_id || '',
    cart_total: Number(cart_total),
    tenant_id: tenantId,
  });

  if (!result.valid) {
    return res.status(400).json(ApiResponse.error(result.message, 400));
  }

  return res.json(ApiResponse.success(result, result.message));
});
