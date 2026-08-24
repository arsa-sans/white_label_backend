import { refundService } from '../refund.service';
import { dataStore } from '../../../database/dataStore';

describe('Refund & Reschedule Service', () => {
  beforeEach(() => {
    // Reset test data
    dataStore.refundRequests = [];
    
    // Ensure test order exists
    const orderExists = dataStore.orders.find((o) => o.id === 'ord-test-refund-001');
    if (!orderExists) {
      dataStore.orders.push({
        id: 'ord-test-refund-001',
        tenant_id: 'tenant-001',
        user_id: 'user-visitor-001',
        event_id: 'evt-001',
        amount: 1500000,
        items: [
          {
            tier_id: 'tier-evt1-vip',
            tier_name: 'VIP (Depan Panggung 0-10m)',
            quantity: 1,
            unit_price: 1500000,
          },
        ],
        status: 'paid',
        idempotency_key: 'idemp-test-ref-001',
        payment_gateway: 'Midtrans',
        created_at: new Date().toISOString(),
      });
    } else {
      orderExists.status = 'paid';
    }
  });

  it('should create refund request successfully for paid order', async () => {
    const result = await refundService.createRefundRequest({
      order_id: 'ord-test-refund-001',
      user_id: 'user-visitor-001',
      tenant_id: 'tenant-001',
      type: 'refund',
      reason: 'Ada acara keluarga mendadak',
    });

    expect(result).toBeDefined();
    expect(result.id).toMatch(/^ref-/);
    expect(result.status).toBe('pending');
    expect(result.type).toBe('refund');
    expect(result.refund_amount).toBe(1500000);
  });

  it('should reject duplicate pending refund request for same order', async () => {
    await refundService.createRefundRequest({
      order_id: 'ord-test-refund-001',
      user_id: 'user-visitor-001',
      tenant_id: 'tenant-001',
      type: 'refund',
      reason: 'Permohonan pertama',
    });

    await expect(
      refundService.createRefundRequest({
        order_id: 'ord-test-refund-001',
        user_id: 'user-visitor-001',
        tenant_id: 'tenant-001',
        type: 'refund',
        reason: 'Permohonan kedua',
      })
    ).rejects.toThrow('sedang dalam proses peninjauan');
  });

  it('should approve refund request, execute direct refund simulation, and void tickets', async () => {
    const created = await refundService.createRefundRequest({
      order_id: 'ord-test-refund-001',
      user_id: 'user-visitor-001',
      tenant_id: 'tenant-001',
      type: 'refund',
      reason: 'Alasan refund',
    });

    const reviewResult = await refundService.reviewRefundRequest(created.id, 'tenant-001', {
      status: 'approved',
      admin_notes: 'Disetujui oleh organizer',
    });

    expect(reviewResult.request.status).toBe('approved');
    expect(reviewResult.midtransResult).toBeDefined();
    expect(reviewResult.midtransResult?.status_code).toBe('200');

    // Check order status
    const order = dataStore.orders.find((o) => o.id === 'ord-test-refund-001');
    expect(order?.status).toBe('refunded');
  });

  it('should handle reject refund request with admin notes', async () => {
    const created = await refundService.createRefundRequest({
      order_id: 'ord-test-refund-001',
      user_id: 'user-visitor-001',
      tenant_id: 'tenant-001',
      type: 'refund',
      reason: 'Mau batal',
    });

    const reviewResult = await refundService.reviewRefundRequest(created.id, 'tenant-001', {
      status: 'rejected',
      admin_notes: 'Event berlangsung besok, refund tidak diizinkan H-1.',
    });

    expect(reviewResult.request.status).toBe('rejected');
    expect(reviewResult.request.admin_notes).toContain('H-1');
  });
});
