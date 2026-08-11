export interface DemoTenant {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
}
export type UserRole = 'visitor' | 'organizer' | 'gate_staff' | 'vendor' | 'admin';
export type ApprovalStatus = 'approved' | 'pending' | 'rejected';
export interface DemoUser {
    id: string;
    tenant_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    /** Organizer only: pending/approved/rejected by admin */
    approval_status: ApprovalStatus;
    /** Organizer only: data event yang diajukan saat registrasi */
    organizer_event_name?: string;
    organizer_event_date?: string;
    organizer_event_location?: string;
    /** Gate staff only: organizer yang mengundang */
    invited_by_organizer_id?: string;
}
export interface DemoInvitation {
    id: string;
    token: string;
    email: string;
    name: string;
    organizer_id: string;
    event_id?: string;
    tenant_id: string;
    expires_at: string;
    used: boolean;
}
export interface DemoPaymentMethod {
    id: string;
    user_id: string;
    type: 'dana' | 'gopay' | 'ovo' | 'bank_transfer' | 'other';
    account_name: string;
    account_number: string;
    is_default: boolean;
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
/** Relasi Gate Staff ↔ Event (staff di-assign ke event tertentu oleh organizer) */
export interface DemoEventStaff {
    id: string;
    event_id: string;
    user_id: string;
    role: 'gate_staff' | 'vendor';
    assigned_at: string;
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
    /**
     * Fresh seed users — password plain-text (demo in-memory only).
     *
     * Default credentials:
     *   admin@demo.wl        : Admin@2026!
     *   organizer@demo.wl    : Organizer@2026!  (status: approved)
     *   gate@demo.wl         : Gate@2026!       (di-invite organizer demo)
     *   visitor@demo.wl      : Visitor@2026!
     */
    users: DemoUser[];
    events: DemoEvent[];
    seats: DemoSeat[];
    seatCategories: DemoSeatCategory[];
    tickets: DemoTicket[];
    orders: DemoOrder[];
    wallets: Map<string, DemoWallet>;
    walletTxs: DemoWalletTx[];
    gateScanLogs: DemoGateScanLog[];
    eventStaff: DemoEventStaff[];
    paymentMethods: DemoPaymentMethod[];
    invitations: DemoInvitation[];
    constructor();
    private seedSeatCategories;
    private generateSeatsForEvent;
}
export declare const dataStore: DataStore;
export {};
//# sourceMappingURL=dataStore.d.ts.map