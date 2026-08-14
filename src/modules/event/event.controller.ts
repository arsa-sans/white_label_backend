/**
 * src/modules/event/event.controller.ts
 *
 * Phase 3 — Event Service (Ticket Tier Based)
 * ─────────────────────────────────────────────
 * Public endpoints (no auth required):
 *   GET /events → list events (search, filter, pagination)
 *   GET /events/:id → event detail + tier stats
 *   GET /events/:id/tiers → ticket tiers list with sisa kuota
 *
 * Organizer-only endpoints (auth + requireRole(['organizer','admin'])):
 *   POST /events → create event (auto seeds default ticket tiers)
 *   PUT /events/:id → update event
 *   DELETE /events/:id → delete event (soft: status → 'deleted')
 *   POST /events/:id/banner → upload banner (Multer file or URL)
 *   GET /events/:id/tiers → list ticket tiers
 *   POST /events/:id/tiers → add/update ticket tier
 *   DELETE /events/:id/tiers/:tierId → remove ticket tier
 *
 * Staff Management:
 *   GET /events/:id/staff → list assigned gate staff & vendors
 *   POST /events/:id/staff → assign gate staff
 *   DELETE /events/:id/staff/:userId → remove staff assignment
 *
 * Admin-only:
 *   GET /events/admin/all → all events across tenants (admin panel)
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
const uuidv4 = () => crypto.randomUUID();
import { dataStore, DemoEvent, DemoTicketTier } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { JwtPayload } from '../../middlewares/auth.middleware';

/* ─── validation schemas ────────────────────────────────────── */

export const createEventSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  category: z.string().optional(),
  location: z.string().min(3, 'Location is required'),
  venue_name: z.string().optional(),
  venue_layout_info: z.string().optional(),
  start_date: z.string().min(1, 'start_date is required'),
  end_date: z.string().min(1, 'end_date is required'),
  capacity: z.union([z.number(), z.string().transform((v) => Number(v))]).optional(),
  banner_url: z.string().optional(),
  status: z.enum(['draft', 'published', 'ended']).optional(),
});

export const upsertTicketTierSchema = z.object({
  tierId: z.string().optional(),
  name: z.string().min(1, 'Tier name is required'),
  description: z.string().optional(),
  price: z.union([z.number(), z.string().transform((v) => Number(v))]),
  quota: z.union([z.number(), z.string().transform((v) => Number(v))]),
  color: z.string().optional(),
  sort_order: z.union([z.number(), z.string().transform((v) => Number(v))]).optional(),
});

/* ─── helpers ─────────────────────────────────────────────── */

function recalculateEventPrices(eventId: string): void {
  const event = dataStore.events.find((e) => e.id === eventId);
  if (!event) return;

  const tiers = dataStore.ticketTiers.filter((t) => t.event_id === eventId);
  if (tiers.length > 0) {
    event.price_min = Math.min(...tiers.map((t) => t.price));
    event.price_max = Math.max(...tiers.map((t) => t.price));
    event.capacity = tiers.reduce((sum, t) => sum + t.quota, 0);
  } else {
    event.price_min = 0;
    event.price_max = 0;
  }
}

/* ─── public: list events ──────────────────────────────────── */

export async function listEvents(req: Request, res: Response): Promise<void> {
  const { category, search, status, min_price, max_price, page = '1', limit = '12' } = req.query;

  const tenantId = req.tenantId || 'tenant-001';
  let result = dataStore.events.filter(
    (e) => e.tenant_id === tenantId && e.status !== 'deleted'
  );

  // Filter by status (default: published)
  if (status && typeof status === 'string') {
    result = result.filter((e) => e.status === status);
  } else {
    result = result.filter((e) => e.status === 'published');
  }

  if (category && typeof category === 'string') {
    result = result.filter((e) => e.category.toLowerCase() === category.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const query = search.toLowerCase();
    result = result.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.location.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
    );
  }

  if (min_price && !isNaN(Number(min_price))) {
    result = result.filter((e) => e.price_max >= Number(min_price));
  }

  if (max_price && !isNaN(Number(max_price))) {
    result = result.filter((e) => e.price_min <= Number(max_price));
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
  const total = result.length;
  const paginated = result.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json(
    ApiResponse.paginated(paginated, pageNum, limitNum, total)
  );
}

/* ─── admin: all events across tenants ─────────────────────── */

export async function listAllEvents(req: Request, res: Response): Promise<void> {
  const events = dataStore.events.filter((e) => e.status !== 'deleted');
  res.json(ApiResponse.success(events, `${events.length} events across all tenants`));
}

/* ─── public: event detail ────────────────────────────────── */

export async function getEventById(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const event = dataStore.events.find((e) => e.id === id && e.status !== 'deleted');

  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  // Compute tier stats
  const tiers = dataStore.ticketTiers.filter((t) => t.event_id === id);
  const totalQuota = tiers.reduce((acc, t) => acc + t.quota, 0);
  const totalSold = tiers.reduce((acc, t) => acc + t.sold, 0);

  res.json(
    ApiResponse.success(
      {
        ...event,
        tiers,
        stats: {
          total_quota: totalQuota,
          total_sold: totalSold,
          available_quota: totalQuota - totalSold,
          sold_percent: totalQuota > 0 ? Math.round((totalSold / totalQuota) * 100) : 0,
        },
      },
      'Event details retrieved successfully'
    )
  );
}

/* ─── public: ticket tiers list ───────────────────────────── */

export async function listTicketTiers(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const tiers = dataStore.ticketTiers.filter((t) => t.event_id === id);
  tiers.sort((a, b) => a.sort_order - b.sort_order);

  const enriched = tiers.map((t) => ({
    ...t,
    available: t.quota - t.sold,
  }));

  res.json(ApiResponse.success(enriched, 'Ticket tiers retrieved'));
}

/* ─── organizer: create event ─────────────────────────────── */

export async function createEvent(req: Request, res: Response): Promise<void> {
  const actor = req.user as JwtPayload;
  const {
    name,
    description,
    category,
    location,
    venue_name,
    venue_layout_info,
    start_date,
    end_date,
    capacity,
    banner_url,
    status = 'draft',
  } = req.body;

  if (!name || !start_date || !end_date || !location) {
    res.status(400).json(ApiResponse.error('name, location, start_date, end_date are required', 400));
    return;
  }

  const newEvent: DemoEvent = {
    id: `evt-${uuidv4().slice(0, 8)}`,
    tenant_id: actor.tenantId,
    organizer_id: actor.userId,
    name,
    description: description || '',
    category: category || 'Concert',
    location,
    venue_name: venue_name || location,
    venue_layout_info: venue_layout_info || 'Area panggung utama berada di titik terdepan. Tier tiket disusun berdasarkan jarak dari panggung.',
    start_date,
    end_date,
    capacity: capacity ? Number(capacity) : 4700,
    banner_url: banner_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
    status: ['draft', 'published'].includes(status) ? status : 'draft',
    price_min: 350000,
    price_max: 1800000,
  };

  dataStore.events.push(newEvent);

  // Seed default ticket tiers for new event based on panggung distance
  const defaultTiers: DemoTicketTier[] = [
    {
      id: `tier-${newEvent.id}-vip`,
      event_id: newEvent.id,
      name: 'VIP Front Stage (0-10m)',
      description: 'Zona terdekat dengan panggung utama. Termasuk Fast-Track Gate & Lounge.',
      price: 1800000,
      quota: 200,
      sold: 0,
      color: '#7C3AED',
      sort_order: 1,
    },
    {
      id: `tier-${newEvent.id}-cat1`,
      event_id: newEvent.id,
      name: 'CAT 1 Near Stage (10-25m)',
      description: 'Zona tengah depan dengan view panggung & lighting optimal.',
      price: 1200000,
      quota: 500,
      sold: 0,
      color: '#2563EB',
      sort_order: 2,
    },
    {
      id: `tier-${newEvent.id}-cat2`,
      event_id: newEvent.id,
      name: 'CAT 2 Mid Field (25-50m)',
      description: 'Zona tengah lapangan dengan kenyamanan suara & LED videotron.',
      price: 750000,
      quota: 1000,
      sold: 0,
      color: '#059669',
      sort_order: 3,
    },
    {
      id: `tier-${newEvent.id}-fest`,
      event_id: newEvent.id,
      name: 'FESTIVAL General (50m+)',
      description: 'Zona festival outdoor paling belakang. Akses area booth kuliner & UMKM.',
      price: 350000,
      quota: 3000,
      sold: 0,
      color: '#D97706',
      sort_order: 4,
    },
  ];

  dataStore.ticketTiers.push(...defaultTiers);
  recalculateEventPrices(newEvent.id);

  res.status(201).json(ApiResponse.success(newEvent, 'Event created successfully with default ticket tiers'));
}

/* ─── organizer: update event ─────────────────────────────── */

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

  const event = dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  if (actor.role === 'organizer' && event.organizer_id !== actor.userId) {
    res.status(403).json(ApiResponse.error('You can only edit your own events', 403));
    return;
  }

  const allowed = ['name', 'description', 'category', 'location', 'venue_name', 'venue_layout_info', 'start_date', 'end_date', 'capacity', 'banner_url', 'status'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      (event as any)[key] = req.body[key];
    }
  }

  res.json(ApiResponse.success(event, 'Event updated successfully'));
}

/* ─── organizer: delete event ─────────────────────────────── */

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

  const event = dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  if (actor.role === 'organizer' && event.organizer_id !== actor.userId) {
    res.status(403).json(ApiResponse.error('You can only delete your own events', 403));
    return;
  }

  event.status = 'deleted';
  res.json(ApiResponse.success({ id }, 'Event deleted successfully'));
}

/* ─── organizer: upload/update banner ────────────────────── */

export async function uploadBanner(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

  const event = dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  if (actor.role === 'organizer' && event.organizer_id !== actor.userId) {
    res.status(403).json(ApiResponse.error('Forbidden', 403));
    return;
  }

  let finalBannerUrl = '';

  if (req.file) {
    const port = process.env.PORT || 4000;
    finalBannerUrl = `http://localhost:${port}/uploads/banners/${req.file.filename}`;
  } else if (req.body?.banner_url && typeof req.body.banner_url === 'string' && req.body.banner_url.trim()) {
    finalBannerUrl = req.body.banner_url.trim();
  } else {
    const UNSPLASH_POOLS = [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=600&fit=crop',
    ];
    finalBannerUrl = UNSPLASH_POOLS[Math.floor(Math.random() * UNSPLASH_POOLS.length)];
  }

  event.banner_url = finalBannerUrl;
  res.json(ApiResponse.success({ banner_url: event.banner_url }, 'Banner updated successfully'));
}

/* ─── organizer: upsert ticket tier ──────────────────────── */

export async function upsertTicketTier(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

  const event = dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  if (actor.role === 'organizer' && event.organizer_id !== actor.userId) {
    res.status(403).json(ApiResponse.error('Forbidden', 403));
    return;
  }

  const { tierId, name, description, price, quota, color, sort_order } = req.body;

  if (!name || price === undefined || quota === undefined) {
    res.status(400).json(ApiResponse.error('name, price, and quota are required', 400));
    return;
  }

  let tier = tierId ? dataStore.ticketTiers.find((t) => t.id === tierId && t.event_id === id) : undefined;

  if (tier) {
    tier.name = name;
    tier.description = description || tier.description;
    tier.price = Number(price);
    tier.quota = Number(quota);
    tier.color = color || tier.color;
    if (sort_order !== undefined) tier.sort_order = Number(sort_order);
  } else {
    const newTier: DemoTicketTier = {
      id: `tier-${id}-${uuidv4().slice(0, 6)}`,
      event_id: id,
      name,
      description: description || '',
      price: Number(price),
      quota: Number(quota),
      sold: 0,
      color: color || '#6366F1',
      sort_order: sort_order ? Number(sort_order) : dataStore.ticketTiers.filter((t) => t.event_id === id).length + 1,
    };
    tier = newTier;
    dataStore.ticketTiers.push(newTier);
  }

  recalculateEventPrices(id);
  res.json(ApiResponse.success(tier, tierId ? 'Ticket tier updated' : 'Ticket tier added'));
}

/* ─── organizer: delete ticket tier ──────────────────────── */

export async function deleteTicketTier(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const tierId = req.params.tierId as string;
  const actor = req.user as JwtPayload;

  const event = dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  if (actor.role === 'organizer' && event.organizer_id !== actor.userId) {
    res.status(403).json(ApiResponse.error('Forbidden', 403));
    return;
  }

  const idx = dataStore.ticketTiers.findIndex((t) => t.id === tierId && t.event_id === id);
  if (idx === -1) {
    res.status(404).json(ApiResponse.error('Ticket tier not found', 404));
    return;
  }

  dataStore.ticketTiers.splice(idx, 1);
  recalculateEventPrices(id);

  res.json(ApiResponse.success({ tierId }, 'Ticket tier deleted'));
}

/* ─── organizer: my events ────────────────────────────────── */

export async function listMyEvents(req: Request, res: Response): Promise<void> {
  const actor = req.user as JwtPayload;
  const { status } = req.query;

  let result = dataStore.events.filter(
    (e) =>
      e.organizer_id === actor.userId &&
      e.tenant_id === actor.tenantId &&
      e.status !== 'deleted'
  );

  if (status && typeof status === 'string') {
    result = result.filter((e) => e.status === status);
  }

  // Attach tier stats per event
  const enriched = result.map((e) => {
    const eventTiers = dataStore.ticketTiers.filter((t) => t.event_id === e.id);
    const totalQuota = eventTiers.reduce((sum, t) => sum + t.quota, 0);
    const totalSold = eventTiers.reduce((sum, t) => sum + t.sold, 0);
    return {
      ...e,
      stats: {
        total_seats: totalQuota, // legacy alias for FE compatibility
        sold_seats: totalSold,
        available_seats: totalQuota - totalSold,
        sold_percent: totalQuota > 0 ? Math.round((totalSold / totalQuota) * 100) : 0,
      },
    };
  });

  res.json(ApiResponse.success(enriched, `${enriched.length} events found`));
}

/* ─── organizer: staff management per event ──────────────── */

export async function listEventStaff(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const eventStaffs = dataStore.eventStaff.filter((es) => es.event_id === eventId);
  const staffDetails = eventStaffs.map((es) => {
    const user = dataStore.users.find((u) => u.id === es.user_id);
    return {
      id: es.id,
      user_id: es.user_id,
      event_id: es.event_id,
      name: user?.name || 'Gate Staff / Vendor',
      email: user?.email || '',
      role: es.role,
      assigned_at: es.assigned_at,
    };
  });

  res.json(ApiResponse.success(staffDetails, 'Daftar staff/vendor event berhasil dimuat'));
}

export async function addEventStaff(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const actor = req.user as JwtPayload;
  const { name, email, password, role = 'gate_staff' } = req.body;

  if (!email || !name || !password) {
    res.status(400).json(ApiResponse.error('Nama, email, dan password wajib diisi', 400));
    return;
  }

  let user = dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    user = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: actor.tenantId || 'tenant-001',
      name,
      email,
      password_hash: password,
      role: role === 'vendor' ? 'vendor' : 'gate_staff',
      approval_status: 'approved',
      invited_by_organizer_id: actor.userId,
    };
    dataStore.users.push(user);
  }

  const existingAssigned = dataStore.eventStaff.find(
    (es) => es.event_id === eventId && es.user_id === user!.id
  );

  if (existingAssigned) {
    res.status(409).json(ApiResponse.error('Akun ini sudah ditugaskan pada event ini', 409));
    return;
  }

  const newAssigned = {
    id: `evtstaff-${crypto.randomUUID().slice(0, 8)}`,
    event_id: eventId,
    user_id: user.id,
    role: (role === 'vendor' ? 'vendor' : 'gate_staff') as 'gate_staff' | 'vendor',
    assigned_at: new Date().toISOString(),
  };

  dataStore.eventStaff.push(newAssigned);

  res.status(201).json(
    ApiResponse.success(
      {
        id: newAssigned.id,
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: newAssigned.role,
        assigned_at: newAssigned.assigned_at,
      },
      'Staff/Vendor berhasil ditambahkan ke event'
    )
  );
}

export async function removeEventStaff(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const userId = req.params.userId as string;

  const idx = dataStore.eventStaff.findIndex(
    (es) => es.event_id === eventId && (es.user_id === userId || es.id === userId)
  );

  if (idx === -1) {
    res.status(404).json(ApiResponse.error('Staff tidak ditemukan pada event ini', 404));
    return;
  }

  dataStore.eventStaff.splice(idx, 1);
  res.json(ApiResponse.success({ event_id: eventId, user_id: userId }, 'Staff berhasil dihapus dari event'));
}
