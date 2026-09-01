/**
 * src/modules/event/event.controller.ts
 *
 * Phase 3 — Event Controller
 * Request parsing, input validation, and delegation to EventService.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse } from '../../utils/apiResponse';
import { JwtPayload } from '../../middlewares/auth.middleware';
import { eventService } from './event.service';
import { CreateEventDto } from './event.types';

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
  sale_start_at: z.string().optional(),
  sale_end_at: z.string().optional(),
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

/* ─── public: list events ──────────────────────────────────── */

export async function listEvents(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId || 'tenant-001';
  const result = eventService.listEvents(tenantId, req.query);

  res.json(
    ApiResponse.paginated(result.items, result.page, result.limit, result.total)
  );
}

/* ─── admin: all events across tenants ─────────────────────── */

export async function listAllEvents(_req: Request, res: Response): Promise<void> {
  const events = eventService.listAllEvents();
  res.json(ApiResponse.success(events, `${events.length} events across all tenants`));
}

/* ─── public: event detail ────────────────────────────────── */

export async function getEventById(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const detail = eventService.getEventDetail(id);

  if (!detail) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  res.json(
    ApiResponse.success(
      {
        ...detail.event,
        tiers: detail.tiers,
        stats: detail.stats,
        sale_status: detail.sale_status,
      },
      'Event details retrieved successfully'
    )
  );
}

/* ─── public: ticket tiers list ───────────────────────────── */

export async function listTicketTiers(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const enriched = eventService.getTicketTiers(id);
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
    sale_start_at,
    sale_end_at,
    guest_stars,
    venue_map_url,
    poster_url,
    terms_conditions,
  } = req.body;

  if (!name || !start_date || !end_date || !location) {
    res.status(400).json(ApiResponse.error('name, location, start_date, end_date are required', 400));
    return;
  }

  const dto: CreateEventDto = {
    name,
    description,
    category,
    location,
    venue_name,
    start_date,
    end_date,
    capacity,
    banner_url,
    status,
    sale_start_at,
    sale_end_at,
    guest_stars,
    venue_map_url,
    poster_url,
    terms_conditions,
  };

  const newEvent = eventService.createEvent(actor.tenantId, actor.userId, dto);
  if (venue_layout_info) {
    newEvent.venue_layout_info = venue_layout_info;
  }

  res.status(201).json(ApiResponse.success(newEvent, 'Event created successfully with default ticket tiers'));
}

/* ─── organizer: update event ─────────────────────────────── */

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

  const result = eventService.updateEvent(id, actor.userId, actor.role, req.body);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error updating event', result.status));
    return;
  }

  res.json(ApiResponse.success(result.data, 'Event updated successfully'));
}

/* ─── organizer: delete event ─────────────────────────────── */

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

  const result = eventService.deleteEvent(id, actor.userId, actor.role);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error deleting event', result.status));
    return;
  }

  res.json(ApiResponse.success({ id }, 'Event deleted successfully'));
}

/* ─── organizer: upload/update banner ────────────────────── */

export async function uploadBanner(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;

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

  const result = eventService.updateBanner(id, actor.userId, actor.role, finalBannerUrl);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error updating banner', result.status));
    return;
  }

  res.json(ApiResponse.success({ banner_url: result.banner_url }, 'Banner updated successfully'));
}

/* ─── organizer: upsert ticket tier ──────────────────────── */

export async function upsertTicketTier(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const actor = req.user as JwtPayload;
  const { tierId, name, description, price, quota, color, sort_order } = req.body;

  if (!name || price === undefined || quota === undefined) {
    res.status(400).json(ApiResponse.error('name, price, and quota are required', 400));
    return;
  }

  const result = eventService.upsertTicketTier(id, actor.userId, actor.role, {
    tierId,
    name,
    description,
    price,
    quota,
    color,
    sort_order,
  });

  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error updating ticket tier', result.status));
    return;
  }

  res.json(ApiResponse.success(result.data, tierId ? 'Ticket tier updated' : 'Ticket tier added'));
}

/* ─── organizer: delete ticket tier ──────────────────────── */

export async function deleteTicketTier(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const tierId = req.params.tierId as string;
  const actor = req.user as JwtPayload;

  const result = eventService.deleteTicketTier(id, tierId, actor.userId, actor.role);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error deleting ticket tier', result.status));
    return;
  }

  res.json(ApiResponse.success({ tierId }, 'Ticket tier deleted'));
}

/* ─── organizer: my events ────────────────────────────────── */

export async function listMyEvents(req: Request, res: Response): Promise<void> {
  const actor = req.user as JwtPayload;
  const { status } = req.query;

  const enriched = eventService.listMyEvents(actor.userId, actor.tenantId, status as string | undefined);
  res.json(ApiResponse.success(enriched, `${enriched.length} events found`));
}

/* ─── organizer: staff management per event ──────────────── */

export async function listEventStaff(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const staffDetails = eventService.listEventStaff(eventId);
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

  const result = eventService.addEventStaff(eventId, actor.tenantId || 'tenant-001', actor.userId, {
    name,
    email,
    password,
    role,
  });

  if (result.status !== 201) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error assigning staff', result.status));
    return;
  }

  res.status(201).json(ApiResponse.success(result.data, 'Staff/Vendor berhasil ditambahkan ke event'));
}

export async function removeEventStaff(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const userId = req.params.userId as string;

  const result = eventService.removeEventStaff(eventId, userId);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error removing staff', result.status));
    return;
  }

  res.json(ApiResponse.success({ event_id: eventId, user_id: userId }, 'Staff berhasil dihapus dari event'));
}

/* ─── multi-day sessions management ───────────────────────── */

export async function listEventSessions(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const sessions = eventService.listEventSessions(eventId);
  res.json(ApiResponse.success(sessions, 'Daftar sesi event berhasil dimuat'));
}

export async function createEventSession(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const { name, date, start_time, end_time, description, sort_order } = req.body;

  if (!name || !date || !start_time || !end_time) {
    res.status(400).json(ApiResponse.error('name, date, start_time, dan end_time wajib diisi', 400));
    return;
  }

  const result = eventService.createEventSession(eventId, {
    name,
    date,
    start_time,
    end_time,
    description,
    sort_order: sort_order ? Number(sort_order) : undefined,
  });

  if (result.status !== 201) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Gagal membuat sesi event', result.status));
    return;
  }

  res.status(201).json(ApiResponse.success(result.data, 'Sesi event berhasil ditambahkan'));
}

export async function updateEventSession(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const sessionId = req.params.sessionId as string;

  const result = eventService.updateEventSession(eventId, sessionId, req.body);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Gagal memperbarui sesi event', result.status));
    return;
  }

  res.json(ApiResponse.success(result.data, 'Sesi event berhasil diperbarui'));
}

export async function deleteEventSession(req: Request, res: Response): Promise<void> {
  const eventId = req.params.id as string;
  const sessionId = req.params.sessionId as string;

  const result = eventService.deleteEventSession(eventId, sessionId);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Gagal menghapus sesi event', result.status));
    return;
  }

  res.json(ApiResponse.success({ sessionId }, 'Sesi event berhasil dihapus'));
}

