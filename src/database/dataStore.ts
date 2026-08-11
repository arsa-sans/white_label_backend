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

  /**
   * Fresh seed users — password plain-text (demo in-memory only).
   *
   * Default credentials:
   *   admin@demo.wl        : Admin@2026!
   *   organizer@demo.wl    : Organizer@2026!  (status: approved)
   *   gate@demo.wl         : Gate@2026!       (di-invite organizer demo)
   *   visitor@demo.wl      : Visitor@2026!
   */
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

    // 2. Organizer Event
    {
      id: 'user-organizer-001',
      tenant_id: 'tenant-001',
      name: 'Elena Rostova',
      email: 'organizer@soundwave.com',
      password_hash: 'Organizer@2026!',
      role: 'organizer',
      approval_status: 'approved',
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
      organizer_event_name: 'Neon Genesis Music Festival 2026',
      organizer_event_date: '2026-09-15',
      organizer_event_location: 'JIExpo Kemayoran, Jakarta',
    },

    // 3. Gate Staff
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

    // 4. Visitor / Penonton
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

    // 5. Vendor Booth
    {
      id: 'user-vendor-001',
      tenant_id: 'tenant-001',
      name: 'Vendor Booth Demo',
      email: 'vendor@demo.wl',
      password_hash: 'Vendor@2026!',
      role: 'vendor',
      approval_status: 'approved',
      invited_by_organizer_id: 'user-organizer-001',
    },
  ];


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
      capacity: 15000,
      banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
      status: 'published',
      price_min: 350000,
      price_max: 1800000,
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
      capacity: 3500,
      banner_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
      status: 'published',
      price_min: 750000,
      price_max: 2500000,
    },
    {
      id: 'evt-003',
      tenant_id: 'tenant-001',
      organizer_id: 'user-organizer-001',
      name: 'Indie Indie Fest 2026',
      category: 'Concert',
      description: 'Festival musik indie lokal 2 hari penuh dengan lebih dari 30 band pilihan & pasar kreatif UMKM.',
      location: 'Senayan Park Lawn, Jakarta',
      venue_name: 'Outdoor Stage',
      start_date: '2026-11-05T13:00:00Z',
      end_date: '2026-11-06T22:00:00Z',
      capacity: 8000,
      banner_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=600&fit=crop',
      status: 'published',
      price_min: 250000,
      price_max: 600000,
    },
  ];

  public seats: DemoSeat[] = [];
  public seatCategories: DemoSeatCategory[] = [];
  public tickets: DemoTicket[] = [];
  public orders: DemoOrder[] = [];
  public wallets: Map<string, DemoWallet> = new Map();
  public walletTxs: DemoWalletTx[] = [];
  public gateScanLogs: DemoGateScanLog[] = [];

  // Tabel baru: relasi gate_staff ke event
  public eventStaff: DemoEventStaff[] = [];

  // Tabel baru: metode pembayaran e-wallet visitor
  public paymentMethods: DemoPaymentMethod[] = [];
  public invitations: DemoInvitation[] = [];

  constructor() {
    this.seedSeatCategories('evt-001', 1800000, 1200000, 750000, 350000);
    this.seedSeatCategories('evt-002', 2500000, 1800000, 1000000, 750000);
    this.seedSeatCategories('evt-003', 600000, 400000, 300000, 250000);

    this.generateSeatsForEvent('evt-001');
    this.generateSeatsForEvent('evt-002');
    this.generateSeatsForEvent('evt-003');

    // Assign demo gate staff ke evt-001
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

    // Seed demo payment method untuk visitor
    this.paymentMethods.push({
      id: 'pm-demo-001',
      user_id: 'user-visitor-001',
      type: 'gopay',
      account_name: 'Budi Santoso',
      account_number: '08123456789',
      is_default: true,
    });

    // Seed satu tiket demo untuk visitor
    const preSeat = this.seats.find((s) => s.event_id === 'evt-001' && s.category === 'VIP');
    if (preSeat) {
      preSeat.status = 'sold';
      const seed = crypto.randomBytes(16).toString('hex');
      const ticket: DemoTicket = {
        id: 'tkt-demo-101',
        event_id: 'evt-001',
        seat_id: preSeat.id,
        user_id: 'user-visitor-001',
        order_id: 'ord-demo-001',
        qr_seed: seed,
        seat_name: `${preSeat.row}-${preSeat.number}`,
        category: preSeat.category,
        price: preSeat.price,
        status: 'valid',
        issued_at: new Date(Date.now() - 86400000).toISOString(),
      };
      this.tickets.push(ticket);

      this.orders.push({
        id: 'ord-demo-001',
        tenant_id: 'tenant-001',
        user_id: 'user-visitor-001',
        event_id: 'evt-001',
        amount: preSeat.price,
        status: 'paid',
        idempotency_key: 'idemp-demo-001',
        payment_gateway: 'Dana',
        gateway_ref: 'DANA-99201',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        seat_ids: [preSeat.id],
      });
    }
  }

  private seedSeatCategories(
    eventId: string,
    vipPrice: number,
    cat1Price: number,
    cat2Price: number,
    festivalPrice: number
  ): void {
    const cats: DemoSeatCategory[] = [
      { id: `cat-${eventId}-vip`,  event_id: eventId, name: 'VIP',      price: vipPrice,      rows: ['A', 'B'],     cols: 10, color: '#7C3AED' },
      { id: `cat-${eventId}-c1`,   event_id: eventId, name: 'CAT 1',    price: cat1Price,     rows: ['C', 'D', 'E'],cols: 12, color: '#2563EB' },
      { id: `cat-${eventId}-c2`,   event_id: eventId, name: 'CAT 2',    price: cat2Price,     rows: ['F', 'G'],     cols: 12, color: '#059669' },
      { id: `cat-${eventId}-fest`, event_id: eventId, name: 'FESTIVAL', price: festivalPrice, rows: ['GA'],         cols: 30, color: '#D97706' },
    ];
    this.seatCategories.push(...cats);
  }

  private generateSeatsForEvent(eventId: string) {
    const categories = this.seatCategories.filter((c) => c.event_id === eventId);
    for (const cat of categories) {
      for (const row of cat.rows) {
        for (let col = 1; col <= cat.cols; col++) {
          const isSold = Math.random() < 0.15;
          this.seats.push({
            id: `seat-${eventId}-${row}${col}`,
            event_id: eventId,
            row,
            number: col,
            category: cat.name,
            price: cat.price,
            status: isSold ? 'sold' : 'available',
          });
        }
      }
    }
  }
}

export const dataStore = new DataStore();
