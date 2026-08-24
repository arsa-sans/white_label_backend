/**
 * src/modules/promo/promo.types.ts
 *
 * Types and DTOs for the Promo & Voucher system.
 */

export type PromoDiscountType = 'percentage' | 'fixed';

export interface PromoCode {
  id: string;
  tenant_id: string;
  event_id?: string;
  code: string;
  type: PromoDiscountType;
  value: number;
  max_uses: number | null;
  used_count: number;
  min_purchase: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export interface PromoUsageLog {
  id: string;
  promo_id: string;
  order_id: string;
  user_id: string;
  discount_amount: number;
  used_at: string;
}

export interface CreatePromoInput {
  tenant_id: string;
  event_id?: string;
  code: string;
  type: PromoDiscountType;
  value: number;
  max_uses?: number | null;
  min_purchase?: number;
  valid_from: string;
  valid_until: string;
  is_active?: boolean;
}

export interface UpdatePromoInput {
  event_id?: string;
  code?: string;
  type?: PromoDiscountType;
  value?: number;
  max_uses?: number | null;
  min_purchase?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface ValidatePromoInput {
  code: string;
  event_id: string;
  cart_total: number;
  tenant_id: string;
}

export interface ValidatePromoResult {
  valid: boolean;
  promo?: PromoCode;
  discount_amount: number;
  final_total: number;
  message: string;
}
