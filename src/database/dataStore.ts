import crypto from 'crypto';

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

class DataStore {
  public tenants: DemoTenant[] = [
    {
      id: 'tenant-001',
      name: 'Soundwave Festival 2026',
      subdomain: 'soundwave',
      logo_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
      primary_color: '243 75% 59%', // Indigo accent
      secondary_color: '199 89% 48%', // Cyan accent
    },
  ];

  public users: DemoUser[] = [
    {
      id: 'user-organizer-1',
      tenant_id: 'tenant-001',
      name: 'Elena Rostova (Organizer)',
      email: 'organizer@soundwave.com',
      password_hash: 'password123',
      role: 'organizer',
    },
    {
      id: 'user-visitor-1',
      tenant_id: 'tenant-001',
      name: 'Budi Santoso (Visitor)',
      email: 'budi@gmail.com',
      password_hash: 'password123',
      role: 'visitor',
    },
    {
      id: 'user-staff-1',
      tenant_id: 'tenant-001',
      name: 'Rudi Gate Staff',
      email: 'gate@soundwave.com',
      password_hash: 'password123',
      role: 'gate_staff',
    },
  ];

  public events: DemoEvent[] = [
    {
      id: 'evt-001',
      tenant_id: 'tenant-001',
      organizer_id: 'user-organizer-1',
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
      organizer_id: 'user-organizer-1',
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
      organizer_id: 'user-organizer-1',
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

  constructor() {
    // Seed seat categories for demo events
    this.seedSeatCategories('evt-001', 1800000, 1200000, 750000, 350000);
    this.seedSeatCategories('evt-002', 2500000, 1800000, 1000000, 750000);
    this.seedSeatCategories('evt-003', 600000, 400000, 300000, 250000);

    this.generateSeatsForEvent('evt-001');
    this.generateSeatsForEvent('evt-002');
    this.generateSeatsForEvent('evt-003');

    // Create initial wallet for demo visitor
    this.wallets.set('user-visitor-1', {
      id: 'wlt-001',
      user_id: 'user-visitor-1',
      event_id: 'evt-001',
      balance: 450000,
      nfc_uid: 'NFC-994821',
    });

    this.walletTxs.push({
      id: 'tx-001',
      wallet_id: 'wlt-001',
      amount: 450000,
      type: 'topup',
      description: 'Initial Top-up via QRIS',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    });

    // Seed one pre-purchased ticket for demo user
    const preSeat = this.seats.find((s) => s.event_id === 'evt-001' && s.category === 'VIP');
    if (preSeat) {
      preSeat.status = 'sold';
      const seed = crypto.randomBytes(16).toString('hex');
      const ticket: DemoTicket = {
        id: 'tkt-demo-101',
        event_id: 'evt-001',
        seat_id: preSeat.id,
        user_id: 'user-visitor-1',
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
        user_id: 'user-visitor-1',
        event_id: 'evt-001',
        amount: preSeat.price,
        status: 'paid',
        idempotency_key: 'idemp-demo-001',
        payment_gateway: 'Midtrans QRIS',
        gateway_ref: 'MID-QRIS-99201',
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
      { id: `cat-${eventId}-vip`,  event_id: eventId, name: 'VIP',      price: vipPrice,      rows: ['A', 'B'],           cols: 10, color: '#7C3AED' },
      { id: `cat-${eventId}-c1`,   event_id: eventId, name: 'CAT 1',    price: cat1Price,     rows: ['C', 'D', 'E'],       cols: 12, color: '#2563EB' },
      { id: `cat-${eventId}-c2`,   event_id: eventId, name: 'CAT 2',    price: cat2Price,     rows: ['F', 'G'],            cols: 12, color: '#059669' },
      { id: `cat-${eventId}-fest`, event_id: eventId, name: 'FESTIVAL', price: festivalPrice, rows: ['GA'],               cols: 30, color: '#D97706' },
    ];
    this.seatCategories.push(...cats);
  }

  private generateSeatsForEvent(eventId: string) {
    const categories = this.seatCategories.filter((c) => c.event_id === eventId);

    for (const cat of categories) {
      for (const row of cat.rows) {
        for (let col = 1; col <= cat.cols; col++) {
          // Pre-mark some seats as sold for realism
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
