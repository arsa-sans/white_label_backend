/**
 * src/modules/payment/payment.service.ts
 *
 * FASE 5 — Payment Service: Business Logic Layer
 *
 * Memisahkan logika bisnis dari HTTP layer (controller).
 * Controller hanya menangani request/response parsing, lalu mendelegasikan ke sini.
 *
 * Sesuai SKILLS.md § Skill 2 (Idempotency Key):
 *   - createOrder     → idempotency via idempotency_key (UNIQUE kolom orders)
 *   - issueTickets    → idempotent per-seat (skip kalau sudah ada tiket untuk order+seat)
 *   - webhook handler → idempotent via gateway_ref (transaction_id dari gateway)
 *
 * Payment gateway modes:
 *   - MIDTRANS_SERVER_KEY tersedia → Midtrans Snap API (sandbox)
 *   - tidak ada key → simulasi lokal (dev mode, tidak butuh akun gateway)
 */
import { DemoOrder, DemoTicket } from '../../database/dataStore';
export interface CreateOrderInput {
    event_id: string;
    seat_ids: string[];
    payment_gateway?: string;
    customer_name?: string;
    customer_email?: string;
    idempotency_key: string;
    user_id: string;
    tenant_id: string;
}
export interface CreateOrderResult {
    order: DemoOrder;
    snap_token: string;
    redirect_url: string;
    amount: number;
    currency: 'IDR';
    gateway: string;
    expires_at: string;
    event_name: string;
    supported_methods: string[];
    gateway_warning?: string;
}
export interface WebhookProcessResult {
    order_id: string;
    new_status: string;
    tickets_issued: number;
    skipped: boolean;
}
export declare function isMidtransConfigured(): boolean;
export declare function createMidtransSnapToken(params: {
    orderId: string;
    grossAmount: number;
    customerName: string;
    customerEmail: string;
    itemDetails: Array<{
        id: string;
        price: number;
        quantity: number;
        name: string;
    }>;
}): Promise<{
    token: string;
    redirect_url: string;
}>;
export declare function verifyMidtransSignature(params: {
    orderId: string;
    statusCode: string;
    grossAmount: string;
    signatureKey: string;
}): boolean;
export declare function createOrderService(input: CreateOrderInput): Promise<CreateOrderResult>;
export declare function issueTicketsForOrder(orderId: string, userId: string, tenantId: string): Promise<DemoTicket[]>;
export declare function processPaymentService(orderId: string, userId: string, tenantId: string, userRole: string): Promise<{
    order: DemoOrder;
    tickets: DemoTicket[];
}>;
type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired';
export declare function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): {
    newStatus: OrderStatus;
    shouldIssueTickets: boolean;
};
export interface MidtransWebhookPayload {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
    transaction_status: string;
    fraud_status?: string;
    transaction_id?: string;
    payment_type?: string;
}
export declare function processWebhookService(payload: MidtransWebhookPayload): Promise<WebhookProcessResult>;
export {};
//# sourceMappingURL=payment.service.d.ts.map