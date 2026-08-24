/**
 * src/modules/refund/refund.types.ts
 *
 * Types for the Refund & Reschedule system with Midtrans Direct Refund support.
 */

export type RefundType = 'refund' | 'reschedule';
export type RefundStatus = 'pending' | 'approved' | 'rejected';

export interface RefundRequest {
  id: string;
  tenant_id: string;
  order_id: string;
  user_id: string;
  ticket_id?: string;
  type: RefundType;
  reason: string;
  status: RefundStatus;
  refund_amount?: number;
  target_event_id?: string;
  target_tier_id?: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface CreateRefundInput {
  order_id: string;
  user_id: string;
  tenant_id: string;
  ticket_id?: string;
  type: RefundType;
  reason: string;
  target_event_id?: string;
  target_tier_id?: string;
}

export interface ReviewRefundInput {
  status: 'approved' | 'rejected';
  admin_notes?: string;
  refund_amount?: number;
  admin_id?: string;
}

export interface MidtransRefundResponse {
  status_code: string;
  status_message: string;
  transaction_id?: string;
  order_id?: string;
  refund_chargeback_id?: string;
  refund_amount?: string;
}
