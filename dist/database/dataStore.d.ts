export interface DemoTenant {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
}
export interface DemoUser {
    id: string;
    tenant_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: 'visitor' | 'organizer' | 'gate_staff' | 'vendor' | 'admin';
}
export interface DemoSeat {
    id: string;
    event_id: string;
    row: string;
    number: number;
    category: string;
    price: number;
    status: 'available' | 'locked' | 'sold';
    locked_until?: string;
    locked_by_user_id?: string;
}
export interface DemoSeatCategory {
    id: string;
    event_id: string;
    name: string;
    price: number;
    rows: string[];
    cols: number;
    color: string;
}
export interface DemoEvent {
    id: string;
    tenant_id: string;
    organizer_id: string;
    name: string;
    description: string;
    category: string;
    location: string;
    venue_name: string;
    start_date: string;
    end_date: string;
    capacity: number;
    banner_url: string;
    status: 'published' | 'draft' | 'ended' | 'deleted';
    price_min: number;
    price_max: number;
}
export interface DemoTicket {
    id: string;
    event_id: string;
    seat_id: string;
    user_id: string;
    order_id: string;
    qr_seed: string;
    seat_name: string;
    category: string;
    price: number;
    status: 'valid' | 'used' | 'void' | 'refunded';
    issued_at: string;
}
export interface DemoOrder {
    id: string;
    tenant_id: string;
    user_id: string;
    event_id: string;
    amount: number;
    status: 'pending' | 'paid' | 'failed' | 'expired';
    idempotency_key: string;
    payment_gateway: string;
    gateway_ref?: string;
    created_at: string;
    seat_ids: string[];
}
export interface DemoWallet {
    id: string;
    user_id: string;
    event_id: string;
    balance: number;
    nfc_uid?: string;
}
export interface DemoWalletTx {
    id: string;
    wallet_id: string;
    amount: number;
    type: 'topup' | 'payment' | 'refund';
    description: string;
    created_at: string;
}
export interface DemoGateScanLog {
    id: string;
    ticket_id: string;
    gate_device_id: string;
    scanned_at: string;
    result: 'valid' | 'invalid' | 'duplicate' | 'expired';
    staff_name?: string;
}
declare class DataStore {
    tenants: DemoTenant[];
    users: DemoUser[];
    events: DemoEvent[];
    seats: DemoSeat[];
    seatCategories: DemoSeatCategory[];
    tickets: DemoTicket[];
    orders: DemoOrder[];
    wallets: Map<string, DemoWallet>;
    walletTxs: DemoWalletTx[];
    gateScanLogs: DemoGateScanLog[];
    constructor();
    private seedSeatCategories;
    private generateSeatsForEvent;
}
export declare const dataStore: DataStore;
export {};
//# sourceMappingURL=dataStore.d.ts.map