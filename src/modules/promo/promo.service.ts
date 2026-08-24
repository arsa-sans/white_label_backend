/**
 * src/modules/promo/promo.service.ts
 *
 * Business logic layer for promo codes & vouchers.
 */

import { promoRepository, PromoRepository } from './promo.repository';
import {
  PromoCode,
  CreatePromoInput,
  UpdatePromoInput,
  ValidatePromoInput,
  ValidatePromoResult,
} from './promo.types';

export class PromoService {
  constructor(private repo: PromoRepository = promoRepository) {}

  async listPromos(tenantId: string, eventId?: string): Promise<PromoCode[]> {
    return this.repo.list(tenantId, eventId);
  }

  async getPromoById(id: string, tenantId: string): Promise<PromoCode | null> {
    return this.repo.findById(id, tenantId);
  }

  async createPromo(input: CreatePromoInput): Promise<PromoCode> {
    // Check if code already exists for tenant
    const existing = await this.repo.findByCode(input.code, input.tenant_id);
    if (existing) {
      throw new Error(`Kode promo "${input.code.toUpperCase()}" sudah digunakan pada tenant ini.`);
    }

    if (input.type === 'percentage' && (input.value <= 0 || input.value > 100)) {
      throw new Error('Nilai diskon persentase harus berada di antara 1% dan 100%.');
    }

    if (input.type === 'fixed' && input.value <= 0) {
      throw new Error('Nominal potongan diskon harus lebih dari 0.');
    }

    const fromDate = new Date(input.valid_from);
    const untilDate = new Date(input.valid_until);
    if (untilDate <= fromDate) {
      throw new Error('Tanggal berakhir promo harus lebih besar dari tanggal mulai.');
    }

    return this.repo.create(input);
  }

  async updatePromo(id: string, tenantId: string, input: UpdatePromoInput): Promise<PromoCode> {
    if (input.code) {
      const existing = await this.repo.findByCode(input.code, tenantId);
      if (existing && existing.id !== id) {
        throw new Error(`Kode promo "${input.code.toUpperCase()}" sudah digunakan.`);
      }
    }

    const updated = await this.repo.update(id, tenantId, input);
    if (!updated) {
      throw new Error('Kode promo tidak ditemukan.');
    }
    return updated;
  }

  async deletePromo(id: string, tenantId: string): Promise<boolean> {
    const success = await this.repo.delete(id, tenantId);
    if (!success) {
      throw new Error('Kode promo tidak ditemukan atau gagal dihapus.');
    }
    return true;
  }

  async validatePromo(input: ValidatePromoInput): Promise<ValidatePromoResult> {
    const promo = await this.repo.findByCode(input.code, input.tenant_id);
    if (!promo) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: 'Kode promo tidak valid atau tidak ditemukan.',
      };
    }

    if (!promo.is_active) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: 'Kode promo saat ini sedang dinonaktifkan.',
      };
    }

    const now = new Date();
    const validFrom = new Date(promo.valid_from);
    const validUntil = new Date(promo.valid_until);

    if (now < validFrom) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: `Kode promo baru dapat digunakan mulai ${validFrom.toLocaleDateString('id-ID')}.`,
      };
    }

    if (now > validUntil) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: 'Masa berlaku kode promo ini telah habis.',
      };
    }

    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: 'Kuota pemakaian kode promo ini sudah habis.',
      };
    }

    if (promo.event_id && input.event_id && promo.event_id !== input.event_id) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: 'Kode promo ini tidak berlaku untuk event yang dipilih.',
      };
    }

    if (input.cart_total < promo.min_purchase) {
      return {
        valid: false,
        discount_amount: 0,
        final_total: input.cart_total,
        message: `Minimal pembelian untuk promo ini adalah Rp ${promo.min_purchase.toLocaleString('id-ID')}.`,
      };
    }

    let discountAmount = 0;
    if (promo.type === 'percentage') {
      discountAmount = Math.round((input.cart_total * promo.value) / 100);
    } else {
      discountAmount = Math.min(promo.value, input.cart_total);
    }

    const finalTotal = Math.max(0, input.cart_total - discountAmount);

    return {
      valid: true,
      promo,
      discount_amount: discountAmount,
      final_total: finalTotal,
      message: `Kode promo "${promo.code}" berhasil diterapkan! Anda hemat Rp ${discountAmount.toLocaleString('id-ID')}.`,
    };
  }

  async recordUsage(promoId: string, orderId: string, userId: string, discountAmount: number) {
    await this.repo.incrementUsage(promoId);
    await this.repo.logUsage({
      promo_id: promoId,
      order_id: orderId,
      user_id: userId,
      discount_amount: discountAmount,
    });
  }
}

export const promoService = new PromoService();
