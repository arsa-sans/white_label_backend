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
  public tenants: DemoTenant[] = [
    {
      id: 'tenant-001',
      name: 'Soundwave Festival 2026',
      subdomain: 'soundwave',
      logo_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
      primary_color: '243 75% 59%',
      secondary_color: '199 89% 48%',
    },
  ];

  /** Users with proper roles & organizer-event relationships */
  public users: DemoUser[] = [
    // 1. Admin System
    {
      id: 'user-admin-001',
      tenant_id: 'tenant-001',
      name: 'Admin Soundwave',
      email: 'admin@whitelabel.id',
      password_hash: 'Admin@2026!',
      role: 'admin',
      approval_status: 'approved',
    },
    {
      id: 'user-admin-002',
      tenant_id: 'tenant-001',
      name: 'Admin Soundwave (Alt)',
      email: 'admin@demo.wl',
      password_hash: 'Admin@2026!',
      role: 'admin',
      approval_status: 'approved',
    },

    // 2. Organizer 1 (Elena Rostova)
    {
      id: 'user-organizer-001',
      tenant_id: 'tenant-001',
      name: 'Elena Rostova',
      email: 'organizer@soundwave.com',
      password_hash: 'Organizer@2026!',
      role: 'organizer',
      approval_status: 'approved',
      company_name: 'Soundwave Live Entertainment',
      organizer_event_name: 'Neon Genesis Music Festival 2026',
      organizer_event_date: '2026-09-15',
      organizer_event_location: 'JIExpo Kemayoran, Jakarta',
    },
    {
      id: 'user-organizer-002',
      tenant_id: 'tenant-001',
      name: 'Elena Rostova (Alt)',
      email: 'organizer@demo.wl',
      password_hash: 'Organizer@2026!',
      role: 'organizer',
      approval_status: 'approved',
      company_name: 'Soundwave Live Entertainment',
      organizer_event_name: 'Neon Genesis Music Festival 2026',
      organizer_event_date: '2026-09-15',
      organizer_event_location: 'JIExpo Kemayoran, Jakarta',
    },

    // 3. Organizer 2 (Budi Pratama)
    {
      id: 'user-organizer-003',
      tenant_id: 'tenant-001',
      name: 'Budi Pratama Pro',
      email: 'budi.organizer@gmail.com',
      password_hash: 'Organizer@2026!',
      role: 'organizer',
      approval_status: 'approved',
      company_name: 'Indie Concert Asia',
      organizer_event_name: 'Indie Rock Night 2026',
      organizer_event_date: '2026-11-05',
      organizer_event_location: 'Senayan Park Lawn, Jakarta',
    },

    // 4. Gate Staff
    {
      id: 'user-staff-1',
      tenant_id: 'tenant-001',
      name: 'Rudi Gate Staff',
      email: 'gate@soundwave.com',
      password_hash: 'GateStaff@2026!',
      role: 'gate_staff',
      approval_status: 'approved',
      invited_by_organizer_id: 'user-organizer-001',
    },
    {
      id: 'user-staff-2',
      tenant_id: 'tenant-001',
      name: 'Rudi Gate Staff (Alt)',
      email: 'gate@demo.wl',
      password_hash: 'GateStaff@2026!',
      role: 'gate_staff',
      approval_status: 'approved',
      invited_by_organizer_id: 'user-organizer-001',
    },

    // 5. Visitor / Penonton
    {
      id: 'user-visitor-001',
      tenant_id: 'tenant-001',
      name: 'Budi Santoso',
      email: 'budi@gmail.com',
      password_hash: 'Visitor@2026!',
      role: 'visitor',
      approval_status: 'approved',
    },
    {
      id: 'user-visitor-002',
      tenant_id: 'tenant-001',
      name: 'Budi Santoso (Alt)',
      email: 'visitor@demo.wl',
      password_hash: 'Visitor@2026!',
      role: 'visitor',
      approval_status: 'approved',
    },

    // 6. Vendor Booth
    {
      id: 'user-vendor-001',
      tenant_id: 'tenant-001',
      name: 'Vendor Food & Beverage',
      email: 'vendor@demo.wl',
      password_hash: 'Vendor@2026!',
      role: 'vendor',
      approval_status: 'approved',
      invited_by_organizer_id: 'user-organizer-001',
    },
  ];

  /** Events belonging to organizers */
  public events: DemoEvent[] = [
    {
      id: 'evt-001',
      tenant_id: 'tenant-001',
      organizer_id: 'user-organizer-001',
      name: 'Neon Genesis Music Festival 2026',
      category: 'Concert',
      description: 'Pertunjukan musik elektronik terbesar di Asia Tenggara menampilkan DJ kelas dunia & visual panggung 360 derajat.',
      location: 'JIExpo Kemayoran, Jakarta',
      venue_name: 'Main Stage Arena A',
      start_date: '2026-09-15T16:00:00Z',
      end_date: '2026-09-15T23:59:00Z',
      capacity: 4700,
      banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
      status: 'published',
      price_min: 350000,
      price_max: 1800000,
      venue_layout_info: 'Panggung Utama berada di titik Utara. Area VIP berada tepat di depan panggung (jarak 0-10m), diikuti CAT 1 (10-25m), CAT 2 (25-50m), dan Zona FESTIVAL di area belakang dengan layar videotron raksasa.',
      guest_stars: [
        { name: 'DJ Snake', photo_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop', role: 'Headliner DJ' },
        { name: 'KSHMR', photo_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop', role: 'Main Stage DJ' },
        { name: 'Weird Genius', photo_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&h=300&fit=crop', role: 'Local Act' },
        { name: 'BEAUZ', photo_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&h=300&fit=crop', role: 'Supporting DJ' },
      ],
      venue_map_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.2904494758886!2d106.84580731476882!3d-6.225462395494824!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f3f2b2b3b3b3%3A0x3030bfbcaf770b0!2sJIExpo%20Kemayoran!5e0!3m2!1sen!2sid!4v1234567890',
      poster_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=1200&fit=crop',
      terms_conditions: 'Tiket yang sudah dibeli tidak dapat dikembalikan. E-tiket wajib ditunjukkan saat masuk venue. Dilarang membawa makanan & minuman dari luar. Anak di bawah 12 tahun wajib didampingi orang tua.',
    },
    {
      id: 'evt-002',
      tenant_id: 'tenant-001',
      organizer_id: 'user-organizer-001',
      name: 'Tech Horizon Summit 2026',
      category: 'Conference',
      description: 'Konferensi AI & Cloud Infrastructure dengan pembicara global, exhibition booth, & networking VIP lounge.',
      location: 'Grand Ballroom Ritz-Carlton, Jakarta',
      venue_name: 'Grand Ballroom',
      start_date: '2026-10-20T08:00:00Z',
      end_date: '2026-10-21T18:00:00Z',
      capacity: 1000,
      banner_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
      status: 'published',
      price_min: 750000,
      price_max: 2500000,
      venue_layout_info: 'VVIP mendapat meja paling depan panggung utama & VIP networking lounge. Premium di area tengah ballroom. Regular di bagian belakang.',
      guest_stars: [
        { name: 'Andrej Karpathy', photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop', role: 'Keynote Speaker' },
        { name: 'Lisa Su', photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop', role: 'Industry Leader' },
      ],
      venue_map_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.521260322283!2d106.82496081476862!3d-6.198085995507567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f4017881c6a1%3A0x74d5c32158aae93!2sThe%20Ritz-Carlton%2C%20Jakarta!5e0!3m2!1sen!2sid!4v1234567890',
      poster_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=1200&fit=crop',
      terms_conditions: 'Pendaftaran bersifat final dan non-refundable. Peserta wajib hadir tepat waktu. Sertifikat digital akan dikirim via email setelah event.',
    },
    {
      id: 'evt-003',
      tenant_id: 'tenant-001',
      organizer_id: 'user-organizer-003',
      name: 'Indie Rock Night 2026',
      category: 'Concert',
      description: 'Festival musik indie lokal 2 hari penuh dengan lebih dari 30 band pilihan & pasar kreatif UMKM.',
      location: 'Senayan Park Lawn, Jakarta',
      venue_name: 'Outdoor Stage',
      start_date: '2026-11-05T13:00:00Z',
      end_date: '2026-11-06T22:00:00Z',
      capacity: 650,
      banner_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=600&fit=crop',
      status: 'published',
      price_min: 250000,
      price_max: 600000,
      venue_layout_info: 'Standing VIP berada di panggung utama pit depan. General Admission berada di area rumput outdoor.',
      guest_stars: [
        { name: 'Hindia', photo_url: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=300&h=300&fit=crop', role: 'Headliner' },
        { name: 'Feast', photo_url: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=300&h=300&fit=crop', role: 'Band Utama' },
        { name: 'Reality Club', photo_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=300&h=300&fit=crop', role: 'Special Guest' },
      ],
      venue_map_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.2904494758886!2d106.80580731476882!3d-6.225462395494824!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f19b09b0b0b0%3A0x3030bfbcaf770b0!2sSenayan%20Park!5e0!3m2!1sen!2sid!4v1234567890',
      poster_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=1200&fit=crop',
      terms_conditions: 'Festival area outdoor, harap siapkan jas hujan. Tiket berlaku untuk 2 hari. Dilarang membawa tripod dan kamera profesional tanpa izin.',
    },
  ];

  /** Ticket Tiers per event (replacing Seats) */
  public ticketTiers: DemoTicketTier[] = [
    // Event 1 Tiers
    {
      id: 'tier-evt1-vip',
      event_id: 'evt-001',
      name: 'VIP Front Stage (0-10m)',
      description: 'Zona eksklusif tepat di depan panggung utama. Termasuk akses Fast-Track Gate & Merchandise Pack.',
      price: 1800000,
      quota: 200,
      sold: 1, // 1 bought by demo ticket
      color: '#7C3AED',
      sort_order: 1,
    },
    {
      id: 'tier-evt1-cat1',
      event_id: 'evt-001',
      name: 'CAT 1 Near Stage (10-25m)',
      description: 'Zona tengah depan dengan pandangan jelas langsung ke panggung & tata lampu.',
      price: 1200000,
      quota: 500,
      sold: 0,
      color: '#2563EB',
      sort_order: 2,
    },
    {
      id: 'tier-evt1-cat2',
      event_id: 'evt-001',
      name: 'CAT 2 Mid Field (25-50m)',
      description: 'Zona tengah lapangan dengan kenyamanan suara subwoofer & visual layar LED.',
      price: 750000,
      quota: 1000,
      sold: 0,
      color: '#059669',
      sort_order: 3,
    },
    {
      id: 'tier-evt1-fest',
      event_id: 'evt-001',
      name: 'FESTIVAL General (50m+)',
      description: 'Zona outdoor festival paling belakang. Bebas berdiri & menikmati booth kuliner.',
      price: 350000,
      quota: 3000,
      sold: 0,
      color: '#D97706',
      sort_order: 4,
    },

    // Event 2 Tiers
    {
      id: 'tier-evt2-vvip',
      event_id: 'evt-002',
      name: 'VVIP Executive',
      description: 'Akses meja terdepan, private lounge, & gala dinner dengan pembicara.',
      price: 2500000,
      quota: 100,
      sold: 0,
      color: '#7C3AED',
      sort_order: 1,
    },
    {
      id: 'tier-evt2-premium',
      event_id: 'evt-002',
      name: 'Premium Pass',
      description: 'Akses seating area depan & materi e-book konferensi.',
      price: 1500000,
      quota: 300,
      sold: 0,
      color: '#2563EB',
      sort_order: 2,
    },
    {
      id: 'tier-evt2-reg',
      event_id: 'evt-002',
      name: 'Regular Conference Pass',
      description: 'Akses seluruh sesi presentasi & area pameran.',
      price: 750000,
      quota: 600,
      sold: 0,
      color: '#059669',
      sort_order: 3,
    },

    // Event 3 Tiers
    {
      id: 'tier-evt3-vip',
      event_id: 'evt-003',
      name: 'Standing VIP Pit',
      description: 'Area berdiri tepat di barikade panggung band indie.',
      price: 600000,
      quota: 150,
      sold: 0,
      color: '#7C3AED',
      sort_order: 1,
    },
    {
      id: 'tier-evt3-gen',
      event_id: 'evt-003',
      name: 'General Admission',
      description: 'Bebas piknik & nonton dari area taman rumput.',
      price: 2500000,
      quota: 500,
      sold: 0,
      color: '#D97706',
      sort_order: 2,
    },
  ];

  public tickets: DemoTicket[] = [];
  public orders: DemoOrder[] = [];
  public wallets: Map<string, DemoWallet> = new Map();
  public walletTxs: DemoWalletTx[] = [];
  public gateScanLogs: DemoGateScanLog[] = [];

  /** Gate Staff & Vendor assignments */
  public eventStaff: DemoEventStaff[] = [];
  public vendors: DemoVendor[] = [];

  public paymentMethods: DemoPaymentMethod[] = [];
  public invitations: DemoInvitation[] = [];

  /** Promo, Refund & Event Session collections */
  public promoCodes: DemoPromoCode[] = [];
  public promoUsageLogs: DemoPromoUsageLog[] = [];
  public refundRequests: DemoRefundRequest[] = [];
  public eventSessions: DemoEventSession[] = [];

  constructor() {
    // Seed initial event sessions for evt-001
    this.eventSessions.push(
      {
        id: 'sess-evt1-day1',
        event_id: 'evt-001',
        name: 'Day 1 — Rock & Electronic Odyssey',
        date: '2026-09-15',
        start_time: '15:00',
        end_time: '23:00',
        description: 'Pembukaan festival dengan headliner rock alternatif & pertunjukan visual laser panggung megah.',
        sort_order: 1,
      },
      {
        id: 'sess-evt1-day2',
        event_id: 'evt-001',
        name: 'Day 2 — Indie Pop & EDM Finale',
        date: '2026-09-16',
        start_time: '14:00',
        end_time: '23:45',
        description: 'Malam penutupan dengan parade artis indie nusantara dan panggung midnight EDM rave.',
        sort_order: 2,
      }
    );

    // Seed initial promo codes
    this.promoCodes.push(
      {
        id: 'promo-001',
        tenant_id: 'tenant-001',
        event_id: 'evt-001',
        code: 'DISKON20',
        type: 'percentage',
        value: 20, // 20% discount
        max_uses: 100,
        used_count: 5,
        min_purchase: 500000,
        valid_from: new Date(Date.now() - 86400000).toISOString(),
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'promo-002',
        tenant_id: 'tenant-001',
        code: 'EARLYBIRD50K',
        type: 'fixed',
        value: 50000, // Rp 50.000 discount
        max_uses: 50,
        used_count: 12,
        min_purchase: 300000,
        valid_from: new Date(Date.now() - 86400000).toISOString(),
        valid_until: new Date(Date.now() + 60 * 86400000).toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'promo-003',
        tenant_id: 'tenant-001',
        code: 'SOUNDWAVE10',
        type: 'percentage',
        value: 10,
        max_uses: null, // unlimited
        used_count: 42,
        min_purchase: 200000,
        valid_from: new Date(Date.now() - 86400000).toISOString(),
        valid_until: new Date(Date.now() + 90 * 86400000).toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      }
    );

    // Assign demo staff & vendors
    this.eventStaff.push({
      id: 'evtstaff-001',
      event_id: 'evt-001',
      user_id: 'user-staff-1',
      role: 'gate_staff',
      assigned_at: new Date().toISOString(),
    });
    this.eventStaff.push({
      id: 'evtstaff-002',
      event_id: 'evt-001',
      user_id: 'user-vendor-001',
      role: 'vendor',
      assigned_at: new Date().toISOString(),
    });

    this.vendors.push({
      id: 'vendor-001',
      event_id: 'evt-001',
      owner_user_id: 'user-vendor-001',
      booth_name: 'Soundwave Snack & Drinks',
      category: 'Food & Beverage',
      created_at: new Date().toISOString(),
    });

    // Seed payment method
    this.paymentMethods.push({
      id: 'pm-demo-001',
      user_id: 'user-visitor-001',
      type: 'gopay',
      account_name: 'Budi Santoso',
      account_number: '08123456789',
      is_default: true,
    });

    // Seed one demo ticket for visitor
    const seed = crypto.randomBytes(16).toString('hex');
    const vipTier = this.ticketTiers.find((t) => t.id === 'tier-evt1-vip')!;

    const ticket: DemoTicket = {
      id: 'tkt-demo-101',
      event_id: 'evt-001',
      tier_id: vipTier.id,
      tier_name: vipTier.name,
      user_id: 'user-visitor-001',
      order_id: 'ord-demo-001',
      qr_seed: seed,
      price: vipTier.price,
      status: 'valid',
      issued_at: new Date(Date.now() - 86400000).toISOString(),
    };
    this.tickets.push(ticket);

    this.orders.push({
      id: 'ord-demo-001',
      tenant_id: 'tenant-001',
      user_id: 'user-visitor-001',
      event_id: 'evt-001',
      amount: vipTier.price,
      items: [
        {
          tier_id: vipTier.id,
          tier_name: vipTier.name,
          quantity: 1,
          unit_price: vipTier.price,
        },
      ],
      status: 'paid',
      idempotency_key: 'idemp-demo-001',
      payment_gateway: 'Dana',
      gateway_ref: 'DANA-99201',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    });
  }
}

export const dataStore = new DataStore();
