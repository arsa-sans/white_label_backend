/**
 * src/modules/refund/refund.repository.ts
 *
 * Repository for Refund and Reschedule requests.
 */

import { dataStore, DemoRefundRequest } from '../../database/dataStore';
import { RefundRequest, CreateRefundInput, ReviewRefundInput } from './refund.types';

export class RefundRepository {
  async findById(id: string, tenantId: string): Promise<RefundRequest | null> {
    const item = dataStore.refundRequests.find(
      (r) => r.id === id && r.tenant_id === tenantId
    );
    return item ? { ...item } : null;
  }

  async listByUser(userId: string, tenantId: string): Promise<RefundRequest[]> {
    return dataStore.refundRequests
      .filter((r) => r.user_id === userId && r.tenant_id === tenantId)
      .map((r) => ({ ...r }));
  }

  async listAll(tenantId: string, eventId?: string): Promise<RefundRequest[]> {
    return dataStore.refundRequests
      .filter((r) => {
        if (r.tenant_id !== tenantId) return false;
        if (eventId && r.target_event_id && r.target_event_id !== eventId) return false;
        return true;
      })
      .map((r) => ({ ...r }));
  }

  async create(input: CreateRefundInput, calculatedAmount?: number): Promise<RefundRequest> {
    const newRequest: DemoRefundRequest = {
      id: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: input.tenant_id,
      order_id: input.order_id,
      user_id: input.user_id,
      ticket_id: input.ticket_id,
      type: input.type,
      reason: input.reason,
      status: 'pending',
      refund_amount: calculatedAmount,
      target_event_id: input.target_event_id,
      target_tier_id: input.target_tier_id,
      created_at: new Date().toISOString(),
    };

    dataStore.refundRequests.push(newRequest);
    return { ...newRequest };
  }

  async updateStatus(
    id: string,
    tenantId: string,
    input: ReviewRefundInput
  ): Promise<RefundRequest | null> {
    const item = dataStore.refundRequests.find((r) => r.id === id && r.tenant_id === tenantId);
    if (!item) return null;

    item.status = input.status;
    item.admin_notes = input.admin_notes || item.admin_notes;
    if (input.refund_amount !== undefined) item.refund_amount = input.refund_amount;
    item.reviewed_by = input.admin_id;
    item.reviewed_at = new Date().toISOString();

    return { ...item };
  }
}

export const refundRepository = new RefundRepository();
