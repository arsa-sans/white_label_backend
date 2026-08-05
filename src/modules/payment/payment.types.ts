export interface CreateOrderDto {
  event_id: string;
  seat_ids: string[];
  idempotency_key: string;
  payment_gateway?: string;
}

export interface PaymentWebhookDto {
  order_id: string;
  status: 'paid' | 'failed' | 'expired';
  gateway_ref?: string;
}
