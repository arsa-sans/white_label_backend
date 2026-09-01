import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** Organizer verification fields */
  nik?: string;
  company_name?: string;
  organizer_event_name?: string;
  organizer_event_date?: string;
  organizer_event_location?: string;
  organizer_event_description?: string;
  portfolio_url?: string;
  npwp?: string;
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

export interface DemoTicketTier {
  id: string;
  event_id: string;
  name: string;          // e.g. "VIP (Depan Panggung 0-10m)", "CAT 1", "FESTIVAL"
  description: string;   // e.g. "Area khusus berdiri paling depan panggung utama"
  price: number;
  quota: number;         // Total kuota tiket untuk tier ini
  sold: number;          // Jumlah tiket yang sudah terjual
  color: string;         // Warna representasi badge
  sort_order: number;    // Urutan tier (1 = paling dekat panggung)
  session_id?: string;   // Sesi event khusus (Day 1 / Day 2)
  is_all_day_pass?: boolean; // Berlaku untuk semua sesi
}

export interface DemoPromoCode {
  id: string;
  tenant_id: string;
  event_id?: string;     // null/undefined = berlaku semua event di tenant
  code: string;          // e.g. "DISKON20", "EARLYBIRD50K"
  type: 'percentage' | 'fixed';
  value: number;         // persentase (e.g. 20) atau nominal (e.g. 50000)
  max_uses: number | null;// null = unlimited
  used_count: number;
  min_purchase: number;  // min nominal order
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export interface DemoPromoUsageLog {
  id: string;
  promo_id: string;
  order_id: string;
  user_id: string;
  discount_amount: number;
  used_at: string;
}

export interface DemoRefundRequest {
  id: string;
  tenant_id: string;
  order_id: string;
  user_id: string;
  ticket_id?: string;
  type: 'refund' | 'reschedule';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  refund_amount?: number;
  target_event_id?: string;
  target_tier_id?: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface DemoEventSession {
  id: string;
  event_id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
  sort_order: number;
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
  venue_layout_info?: string; // Deskripsi/penjelasan tata letak panggung & penonton
  guest_stars?: Array<{ name: string; photo_url: string; role: string }>;
  venue_map_url?: string;        // Google Maps share/embed URL from organizer
  poster_url?: string;           // Poster event (separate from banner)
  terms_conditions?: string;     // Ticket terms & conditions
  /** Sale schedule — kapan penjualan tiket dimulai & ditutup */
  sale_start_at?: string;        // ISO datetime — penjualan tiket dimulai
  sale_end_at?: string;          // ISO datetime — penjualan tiket ditutup
  /** SaaS Event Staff & Vendor Feature Activation Fee */
  staff_fee_paid?: boolean;      // True jika organizer sudah membayar biaya aktivasi staff untuk event ini
}

/** Relasi Gate Staff / Vendor ↔ Event */
export interface DemoEventStaff {
  id: string;
  event_id: string;
  user_id: string;
  role: 'gate_staff' | 'vendor';
  assigned_at: string;
}

export interface DemoVendor {
  id: string;
  event_id: string;
  owner_user_id: string;
  booth_name: string;
  category: string;
  created_at: string;
}

export interface DemoTicket {
  id: string;
  event_id: string;
  tier_id: string;
  tier_name: string;
  user_id: string;
  order_id: string;
  qr_seed: string;
  price: number;
  status: 'valid' | 'used' | 'void' | 'refunded';
  issued_at: string;
}

export interface DemoOrderItem {
  tier_id: string;
  tier_name: string;
  quantity: number;
  unit_price: number;
}

export interface DemoOrder {
  id: string;
  tenant_id: string;
  user_id: string;
  event_id: string;
  amount: number;
  items: DemoOrderItem[];
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  idempotency_key: string;
  payment_gateway: string;
  gateway_ref?: string;
  promo_code?: string;
  discount_amount?: number;
  gross_amount?: number;
  created_at: string;
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

// ─── DataStore ────────────────────────────────────────────────────────────────

class DataStore {
  /** Default tenant — platform harus punya minimal 1 tenant */
  public tenants: DemoTenant[] = [
    {
      id: 'tenant-001',
      name: 'WhiteLabel Event Platform',
      subdomain: 'main',
      logo_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
      primary_color: '243 75% 59%',
      secondary_color: '199 89% 48%',
    },
  ];

  /** Users — dimulai kosong, bootstrap admin ditambah di constructor */
  public users: DemoUser[] = [];

  /** Events — dibuat oleh organizer via dashboard */
  public events: DemoEvent[] = [];

  /** Ticket Tiers — dibuat oleh organizer per event */
  public ticketTiers: DemoTicketTier[] = [];

  /** Tickets — dibuat saat visitor checkout */
  public tickets: DemoTicket[] = [];

  /** Orders — dibuat saat visitor checkout */
  public orders: DemoOrder[] = [];

  /** Wallets & Transactions */
  public wallets: Map<string, DemoWallet> = new Map();
  public walletTxs: DemoWalletTx[] = [];

  /** Gate scan logs */
  public gateScanLogs: DemoGateScanLog[] = [];

  /** Gate Staff & Vendor assignments — dibuat oleh organizer per event */
  public eventStaff: DemoEventStaff[] = [];
  public vendors: DemoVendor[] = [];

  /** Payment methods — dibuat oleh visitor */
  public paymentMethods: DemoPaymentMethod[] = [];

  /** Staff invitations — dibuat oleh organizer */
  public invitations: DemoInvitation[] = [];

  /** Promo codes — dibuat oleh organizer */
  public promoCodes: DemoPromoCode[] = [];
  public promoUsageLogs: DemoPromoUsageLog[] = [];

  /** Refund requests */
  public refundRequests: DemoRefundRequest[] = [];

  /** Event sessions (multi-day) — dibuat oleh organizer */
  public eventSessions: DemoEventSession[] = [];

  constructor() {
    // ── Bootstrap: buat 1 akun admin default jika belum ada ──
    // Ini adalah satu-satunya data awal yang di-seed.
    // Semua data lain (organizer, event, tiket, dll) dibuat secara
    // organik oleh pengguna melalui aplikasi.
    if (!this.users.find((u) => u.role === 'admin')) {
      this.users.push({
        id: 'user-admin-001',
        tenant_id: 'tenant-001',
        name: 'Admin WhiteLabel',
        email: 'admin@whitelabel.id',
        password_hash: 'Admin@2026!',
        role: 'admin',
        approval_status: 'approved',
      });
    }
  }
}

export const dataStore = new DataStore();
