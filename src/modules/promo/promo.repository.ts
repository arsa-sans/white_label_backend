/**
 * src/modules/promo/promo.repository.ts
 *
 * Repository for Promo Codes and Usage Logs with DataStore persistence.
 */

import { dataStore, DemoPromoCode, DemoPromoUsageLog } from '../../database/dataStore';
import { PromoCode, CreatePromoInput, UpdatePromoInput, PromoUsageLog } from './promo.types';

export class PromoRepository {
  async findById(id: string, tenantId: string): Promise<PromoCode | null> {
    const promo = dataStore.promoCodes.find(
      (p) => p.id === id && p.tenant_id === tenantId
    );
    return promo ? { ...promo } : null;
  }

  async findByCode(code: string, tenantId: string): Promise<PromoCode | null> {
    const promo = dataStore.promoCodes.find(
      (p) => p.code.toUpperCase() === code.trim().toUpperCase() && p.tenant_id === tenantId
    );
    return promo ? { ...promo } : null;
  }

  async list(tenantId: string, eventId?: string): Promise<PromoCode[]> {
    return dataStore.promoCodes
      .filter((p) => {
        if (p.tenant_id !== tenantId) return false;
        if (eventId && p.event_id && p.event_id !== eventId) return false;
        return true;
      })
      .map((p) => ({ ...p }));
  }

  async create(input: CreatePromoInput): Promise<PromoCode> {
    const newPromo: DemoPromoCode = {
      id: `promo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: input.tenant_id,
      event_id: input.event_id,
      code: input.code.trim().toUpperCase(),
      type: input.type,
      value: input.value,
      max_uses: input.max_uses ?? null,
      used_count: 0,
      min_purchase: input.min_purchase ?? 0,
      valid_from: input.valid_from,
      valid_until: input.valid_until,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
    };

    dataStore.promoCodes.push(newPromo);
    return { ...newPromo };
  }

  async update(id: string, tenantId: string, input: UpdatePromoInput): Promise<PromoCode | null> {
    const promo = dataStore.promoCodes.find((p) => p.id === id && p.tenant_id === tenantId);
    if (!promo) return null;

    if (input.code !== undefined) promo.code = input.code.trim().toUpperCase();
    if (input.event_id !== undefined) promo.event_id = input.event_id;
    if (input.type !== undefined) promo.type = input.type;
    if (input.value !== undefined) promo.value = input.value;
    if (input.max_uses !== undefined) promo.max_uses = input.max_uses;
    if (input.min_purchase !== undefined) promo.min_purchase = input.min_purchase;
    if (input.valid_from !== undefined) promo.valid_from = input.valid_from;
    if (input.valid_until !== undefined) promo.valid_until = input.valid_until;
    if (input.is_active !== undefined) promo.is_active = input.is_active;

    return { ...promo };
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const idx = dataStore.promoCodes.findIndex((p) => p.id === id && p.tenant_id === tenantId);
    if (idx === -1) return false;
    dataStore.promoCodes.splice(idx, 1);
    return true;
  }

  async incrementUsage(promoId: string): Promise<void> {
    const promo = dataStore.promoCodes.find((p) => p.id === promoId);
    if (promo) {
      promo.used_count += 1;
    }
  }

  async logUsage(log: Omit<PromoUsageLog, 'id' | 'used_at'>): Promise<PromoUsageLog> {
    const entry: DemoPromoUsageLog = {
      id: `pul-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      promo_id: log.promo_id,
      order_id: log.order_id,
      user_id: log.user_id,
      discount_amount: log.discount_amount,
      used_at: new Date().toISOString(),
    };
    dataStore.promoUsageLogs.push(entry);
    return entry;
  }
}

export const promoRepository = new PromoRepository();
