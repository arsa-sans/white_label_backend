import { PromoService } from '../promo.service';
import { PromoRepository } from '../promo.repository';

describe('PromoService Unit Tests', () => {
  let promoService: PromoService;
  let promoRepo: PromoRepository;

  beforeEach(() => {
    promoRepo = new PromoRepository();
    promoService = new PromoService(promoRepo);
  });

  it('should validate an active percentage promo code correctly', async () => {
    const res = await promoService.validatePromo({
      code: 'DISKON20',
      event_id: 'evt-001',
      cart_total: 1000000,
      tenant_id: 'tenant-001',
    });

    expect(res.valid).toBe(true);
    expect(res.discount_amount).toBe(200000); // 20% of 1,000,000
    expect(res.final_total).toBe(800000);
  });

  it('should validate an active fixed nominal promo code correctly', async () => {
    const res = await promoService.validatePromo({
      code: 'EARLYBIRD50K',
      event_id: 'evt-001',
      cart_total: 500000,
      tenant_id: 'tenant-001',
    });

    expect(res.valid).toBe(true);
    expect(res.discount_amount).toBe(50000);
    expect(res.final_total).toBe(450000);
  });

  it('should reject promo if minimum purchase is not met', async () => {
    const res = await promoService.validatePromo({
      code: 'DISKON20',
      event_id: 'evt-001',
      cart_total: 100000, // min is 500000
      tenant_id: 'tenant-001',
    });

    expect(res.valid).toBe(false);
    expect(res.discount_amount).toBe(0);
    expect(res.message).toContain('Minimal pembelian');
  });

  it('should reject non-existent promo code', async () => {
    const res = await promoService.validatePromo({
      code: 'NOTEXIST99',
      event_id: 'evt-001',
      cart_total: 1000000,
      tenant_id: 'tenant-001',
    });

    expect(res.valid).toBe(false);
    expect(res.message).toContain('tidak valid');
  });

  it('should create and list new promo codes', async () => {
    const newPromo = await promoService.createPromo({
      tenant_id: 'tenant-001',
      code: 'FLASHSALE30',
      type: 'percentage',
      value: 30,
      max_uses: 20,
      min_purchase: 100000,
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 86400000).toISOString(),
    });

    expect(newPromo.code).toBe('FLASHSALE30');
    expect(newPromo.value).toBe(30);

    const list = await promoService.listPromos('tenant-001');
    const found = list.find((p) => p.code === 'FLASHSALE30');
    expect(found).toBeDefined();
  });
});
