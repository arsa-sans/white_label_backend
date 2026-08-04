/**
 * src/modules/event/event.controller.ts
 *
 * Phase 3 — Event Service (Full Implementation)
 * ─────────────────────────────────────────────
 * Public endpoints (no auth required):
 *   GET /events → list events (search, filter, pagination)
 *   GET /events/:id → event detail
 *   GET /events/:id/seats → seat map layout (with lock expiry check)
 *
 * Organizer-only endpoints (auth + requireRole(['organizer','admin'])):
 *   POST /events → create event
 *   PUT /events/:id → update event
 *   DELETE /events/:id → delete event (soft: status → 'deleted')
 *   POST /events/:id/banner → upload banner (Multer file or URL)
 *   GET /events/:id/seat-categories → list seat categories
 *   POST /events/:id/seat-categories → add/replace seat category
 *   DELETE /events/:id/seat-categories/:catId → remove seat category
 *   POST /events/:id/regenerate-seats → rebuild seat layout from categories
 *
 * Admin-only:
 *   GET /events/admin/all → all events across tenants (admin panel)
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
const uuidv4 = () => crypto.randomUUID();
import { dataStore, DemoEvent, DemoSeatCategory } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { JwtPayload } from '../../middlewares/auth.middleware';

/* ─── validation schemas ────────────────────────────────────── */

export const createEventSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  category: z.string().optional(),
  location: z.string().min(3, 'Location is required'),
  venue_name: z.string().optional(),
  start_date: z.string().min(1, 'start_date is required'),
  end_date: z.string().min(1, 'end_date is required'),
  capacity: z.union([z.number(), z.string().transform((v) => Number(v))]).optional(),
  banner_url: z.string().optional(),
  status: z.enum(['draft', 'published', 'ended']).optional(),
});

export const upsertSeatCategorySchema = z.object({
  catId: z.string().optional(),
  name: z.string().min(1, 'Category name is required'),
  price: z.union([z.number(), z.string().transform((v) => Number(v))]),
  rows: z.union([z.array(z.string()), z.string().transform((v) => [v])]),
  cols: z.union([z.number(), z.string().transform((v) => Number(v))]),
  color: z.string().optional(),
});

/* ─── helpers ─────────────────────────────────────────────── */

function expireLockedSeats(eventId: string): void {
  const now = Date.now();
  dataStore.seats.forEach((seat) => {
    if (seat.event_id === eventId && seat.status === 'locked' && seat.locked_until) {
      if (new Date(seat.locked_until).getTime() < now) {
        seat.status = 'available';
        seat.locked_until = undefined;
        seat.locked_by_user_id = undefined;
      }
    }
  });
}

function rebuildSeatsFromCategories(eventId: string): void {
  // Keep sold seats to avoid orphan tickets
  const soldSeats = dataStore.seats.filter(
    (s) => s.event_id === eventId && s.status === 'sold'
  );
  dataStore.seats = dataStore.seats.filter(
    (s) => s.event_id !== eventId || s.status === 'sold'
  );

  const categories = dataStore.seatCategories.filter((c) => c.event_id === eventId);

  for (const cat of categories) {
    for (const rowLabel of cat.rows) {
      for (let col = 1; col <= cat.cols; col++) {
        const seatId = `seat-${eventId}-${rowLabel}${col}`;
        // Skip if already sold
        const alreadySold = soldSeats.find((s) => s.id === seatId);
        if (alreadySold) continue;

        const isPreSold = Math.random() < 0.08; // 8% pre-sold for realism
        dataStore.seats.push({
          id: seatId,
          event_id: eventId,
          row: rowLabel,
          number: col,
          category: cat.name as any,
          price: cat.price,
          status: isPreSold ? 'sold' : 'available',
        });
      }
    }
  }
}

/* ─── public: list events ──────────────────────────────────── */

export async function listEvents(req: Request, res: Response): Promise<void> {
  const { category, search, status, min_price, max_price, page = '1', limit = '12' } = req.query;

  const tenantId = req.tenantId || 'tenant-001';
  let result = dataStore.events.filter(
    (e) => e.tenant_id === tenantId && e.status !== 'deleted'
  );

  // Filter by status (default: only published for public)
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

  // Attach computed stats
  const allSeats = dataStore.seats.filter((s) => s.event_id === id);
  expireLockedSeats(id);
  const availableSeats = allSeats.filter((s) => s.status === 'available').length;
  const soldSeats = allSeats.filter((s) => s.status === 'sold').length;

  res.json(
    ApiResponse.success(
      {
        ...event,
        stats: {
          total_seats: allSeats.length,
          available_seats: availableSeats,
          sold_seats: soldSeats,
          sold_percent: allSeats.length > 0 ? Math.round((soldSeats / allSeats.length) * 100) : 0,
        },
      },
      'Event details retrieved successfully'
    )
  );
}

/* ─── public: seat map ────────────────────────────────────── */

export async function getEventSeats(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  expireLockedSeats(id);

  const eventSeats = dataStore.seats.filter((s) => s.event_id === id);

  res.json(
    ApiResponse.success(
      {
        event_id: id,
        total_seats: eventSeats.length,
        available_seats: eventSeats.filter((s) => s.status === 'available').length,
        seats: eventSeats,
      },
      'Event seats layout retrieved'
    )
  );
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
    category: category || 'General',
    location,
    venue_name: venue_name || location,
    start_date,
    end_date,
    capacity: capacity ? Number(capacity) : 0,
    banner_url: banner_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=600&fit=crop',
    status: ['draft', 'published'].includes(status) ? status : 'draft',
    price_min: 0,
    price_max: 0,
  };

  dataStore.events.push(newEvent);

  // Seed default seat categories
  const defaultCategories: DemoSeatCategory[] = [
    { id: uuidv4(), event_id: newEvent.id, name: 'VIP', price: 1500000, rows: ['A', 'B'], cols: 10, color: '#7C3AED' },
    { id: uuidv4(), event_id: newEvent.id, name: 'CAT 1', price: 900000, rows: ['C', 'D', 'E'], cols: 12, color: '#2563EB' },
    { id: uuidv4(), event_id: newEvent.id, name: 'CAT 2', price: 500000, rows: ['F', 'G'], cols: 15, color: '#059669' },
    { id: uuidv4(), event_id: newEvent.id, name: 'FESTIVAL', price: 200000, rows: ['GA'], cols: 40, color: '#D97706' },
  ];
  dataStore.seatCategories.push(...defaultCategories);

  // Generate initial seat layout
  rebuildSeatsFromCategories(newEvent.id);

  // Recalculate price_min/max
  const cats = dataStore.seatCategories.filter((c) => c.event_id === newEvent.id);
  if (cats.length) {
    newEvent.price_min = Math.min(...cats.map((c) => c.price));
    newEvent.price_max = Math.max(...cats.map((c) => c.price));
  }

  res.status(201).json(ApiResponse.success(newEvent, 'Event created successfully'));
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

  // Organizers can only edit their own events; admins can edit any
  if (actor.role === 'organizer' && event.organizer_id !== actor.userId) {
    res.status(403).json(ApiResponse.error('You can only edit your own events', 403));
    return;
  }

  const allowed = ['name', 'description', 'category', 'location', 'venue_name', 'start_date', 'end_date', 'capacity', 'banner_url', 'status'];
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

  // Soft delete
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
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=600&fit=crop',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=600&fit=crop',
    ];
    finalBannerUrl = UNSPLASH_POOLS[Math.floor(Math.random() * UNSPLASH_POOLS.length)];
  }

  event.banner_url = finalBannerUrl;

  res.json(
    ApiResponse.success(
      { banner_url: event.banner_url },
      'Banner updated successfully'
    )
  );
}

/* ─── organizer: list seat categories ────────────────────── */

export async function listSeatCategories(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const categories = dataStore.seatCategories.filter((c) => c.event_id === id);
  res.json(ApiResponse.success(categories, 'Seat categories retrieved'));
}

/* ─── organizer: upsert seat category ────────────────────── */

export async function upsertSeatCategory(req: Request, res: Response): Promise<void> {
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

  const { catId, name, price, rows, cols, color } = req.body;

  if (!name || !price || !rows || !cols) {
    res.status(400).json(ApiResponse.error('name, price, rows (array), cols are required', 400));
    return;
  }

  let cat = catId ? dataStore.seatCategories.find((c) => c.id === catId && c.event_id === id) : undefined;

  if (cat) {
    cat.name = name;
    cat.price = Number(price);
    cat.rows = Array.isArray(rows) ? rows : [rows];
    cat.cols = Number(cols);
    cat.color = color || cat.color;
  } else {
    const newCat: DemoSeatCategory = {
      id: uuidv4(),
      event_id: id,
      name,
      price: Number(price),
      rows: Array.isArray(rows) ? rows : [rows],
      cols: Number(cols),
      color: color || '#6366F1',
    };
    cat = newCat;
    dataStore.seatCategories.push(newCat);
  }

  // Recalculate price_min/max on event
  const allCats = dataStore.seatCategories.filter((c) => c.event_id === id);
  event.price_min = Math.min(...allCats.map((c) => c.price));
  event.price_max = Math.max(...allCats.map((c) => c.price));

  res.json(ApiResponse.success(cat, catId ? 'Category updated' : 'Category added'));
}

/* ─── organizer: delete seat category ────────────────────── */

export async function deleteSeatCategory(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const catId = req.params.catId as string;
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

  const idx = dataStore.seatCategories.findIndex((c) => c.id === catId && c.event_id === id);
  if (idx === -1) {
    res.status(404).json(ApiResponse.error('Category not found', 404));
    return;
  }

  dataStore.seatCategories.splice(idx, 1);

  // Recalculate
  const remaining = dataStore.seatCategories.filter((c) => c.event_id === id);
  if (remaining.length) {
    event.price_min = Math.min(...remaining.map((c) => c.price));
    event.price_max = Math.max(...remaining.map((c) => c.price));
  }

  res.json(ApiResponse.success({ catId }, 'Category deleted'));
}

/* ─── organizer: regenerate seat layout ───────────────────── */

export async function regenerateSeats(req: Request, res: Response): Promise<void> {
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

  rebuildSeatsFromCategories(id);
  const newSeats = dataStore.seats.filter((s) => s.event_id === id);

  res.json(
    ApiResponse.success(
      { total_seats: newSeats.length, event_id: id },
      'Seat layout regenerated from categories'
    )
  );
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

  // Attach seat stats per event
  const enriched = result.map((e) => {
    const seats = dataStore.seats.filter((s) => s.event_id === e.id);
    const sold = seats.filter((s) => s.status === 'sold').length;
    const available = seats.filter((s) => s.status === 'available').length;
    return {
      ...e,
      stats: {
        total_seats: seats.length,
        sold_seats: sold,
        available_seats: available,
        sold_percent: seats.length > 0 ? Math.round((sold / seats.length) * 100) : 0,
      },
    };
  });

  res.json(ApiResponse.success(enriched, `${enriched.length} events found`));
}
