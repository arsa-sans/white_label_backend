"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const crypto_1 = __importDefault(require("crypto"));
class DataStore {
    constructor() {
        this.tenants = [
            {
                id: 'tenant-001',
                name: 'Soundwave Festival 2026',
                subdomain: 'soundwave',
                logo_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
                primary_color: '243 75% 59%', // Indigo accent
                secondary_color: '199 89% 48%', // Cyan accent
            },
        ];
        this.users = [
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
        this.events = [
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
        this.seats = [];
        this.seatCategories = [];
        this.tickets = [];
        this.orders = [];
        this.wallets = new Map();
        this.walletTxs = [];
        this.gateScanLogs = [];
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
            const seed = crypto_1.default.randomBytes(16).toString('hex');
            const ticket = {
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
    seedSeatCategories(eventId, vipPrice, cat1Price, cat2Price, festivalPrice) {
        const cats = [
            { id: `cat-${eventId}-vip`, event_id: eventId, name: 'VIP', price: vipPrice, rows: ['A', 'B'], cols: 10, color: '#7C3AED' },
            { id: `cat-${eventId}-c1`, event_id: eventId, name: 'CAT 1', price: cat1Price, rows: ['C', 'D', 'E'], cols: 12, color: '#2563EB' },
            { id: `cat-${eventId}-c2`, event_id: eventId, name: 'CAT 2', price: cat2Price, rows: ['F', 'G'], cols: 12, color: '#059669' },
            { id: `cat-${eventId}-fest`, event_id: eventId, name: 'FESTIVAL', price: festivalPrice, rows: ['GA'], cols: 30, color: '#D97706' },
        ];
        this.seatCategories.push(...cats);
    }
    generateSeatsForEvent(eventId) {
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
exports.dataStore = new DataStore();
//# sourceMappingURL=dataStore.js.map