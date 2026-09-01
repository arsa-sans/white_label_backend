/**
 * src/modules/event/event.service.ts
 *
 * Business logic layer for Event management & Ticket Tiers.
 */

import crypto from 'crypto';
import { dataStore, DemoEvent, DemoTicketTier, DemoEventSession } from '../../database/dataStore';
import { eventRepository } from './event.repository';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { createMidtransSnapToken } from '../payment/payment.service';
import {
  CreateEventDto,
  UpdateEventDto,
  UpsertSeatCategoryDto,
  EventListQuery,
  EventSessionDto,
  UpdateEventSessionDto,
} from './event.types';

const uuidv4 = () => crypto.randomUUID();

export class EventService {
  /**
   * Recalculate event price range & total capacity based on its ticket tiers
   */
  public recalculateEventPrices(eventId: string): void {
    const event = eventRepository.findById(eventId);
    if (!event) return;

    const tiers = eventRepository.getTiersByEventId(eventId);
    if (tiers.length > 0) {
      event.price_min = Math.min(...tiers.map((t) => t.price));
      event.price_max = Math.max(...tiers.map((t) => t.price));
      event.capacity = tiers.reduce((sum, t) => sum + t.quota, 0);
    } else {
      event.price_min = 0;
      event.price_max = 0;
    }
  }

  /**
   * List public events with filtering, search, and pagination
   */
  public listEvents(
    tenantId: string,
    query: EventListQuery
  ): { items: DemoEvent[]; page: number; limit: number; total: number } {
    const { category, search, status, min_price, max_price, page = '1', limit = '12' } = query;

    let result = eventRepository.findPublicByTenant(tenantId);

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
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }

    if (min_price && !isNaN(Number(min_price))) {
      result = result.filter((e) => e.price_max >= Number(min_price));
    }

    if (max_price && !isNaN(Number(max_price))) {
      result = result.filter((e) => e.price_min <= Number(max_price));
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const total = result.length;
    const paginated = result.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return {
      items: paginated,
      page: pageNum,
      limit: limitNum,
      total,
    };
  }

  /**
   * List all events across all tenants (Admin only)
   */
  public listAllEvents(): DemoEvent[] {
    return eventRepository.findAll();
  }

  /**
   * Get single event detail with tier stats
   */
  public getEventDetail(id: string): {
    event: DemoEvent;
    tiers: DemoTicketTier[];
    stats: {
      total_quota: number;
      total_sold: number;
      available_quota: number;
      sold_percent: number;
    };
    sale_status: 'upcoming' | 'open' | 'closed';
  } | null {
    const event = eventRepository.findById(id);
    if (!event) return null;

    const tiers = eventRepository.getTiersByEventId(id);
    const totalQuota = tiers.reduce((acc, t) => acc + t.quota, 0);
    const totalSold = tiers.reduce((acc, t) => acc + t.sold, 0);

    let saleStatus: 'upcoming' | 'open' | 'closed' = 'open';
    const now = new Date();
    if (event.sale_start_at && now < new Date(event.sale_start_at)) {
      saleStatus = 'upcoming';
    } else if (event.sale_end_at && now > new Date(event.sale_end_at)) {
      saleStatus = 'closed';
    }

    return {
      event,
      tiers,
      stats: {
        total_quota: totalQuota,
        total_sold: totalSold,
        available_quota: totalQuota - totalSold,
        sold_percent: totalQuota > 0 ? Math.round((totalSold / totalQuota) * 100) : 0,
      },
      sale_status: saleStatus,
    };
  }

  /**
   * Get ticket tiers for an event
   */
  public getTicketTiers(eventId: string): (DemoTicketTier & { available: number })[] {
    const tiers = eventRepository.getTiersByEventId(eventId);
    tiers.sort((a, b) => a.sort_order - b.sort_order);

    return tiers.map((t) => ({
      ...t,
      available: t.quota - t.sold,
    }));
  }

  /**
   * Create new event with default ticket tiers
   */
  public createEvent(
    tenantId: string,
    organizerId: string,
    dto: CreateEventDto
  ): DemoEvent {
    const newEvent: DemoEvent = {
      id: `evt-${uuidv4().slice(0, 8)}`,
      tenant_id: tenantId,
      organizer_id: organizerId,
      name: dto.name,
      description: dto.description || '',
      category: dto.category || 'Concert',
      location: dto.location,
      venue_name: dto.venue_name || dto.location,
      venue_layout_info:
        'Area panggung utama berada di titik terdepan. Tier tiket disusun berdasarkan jarak dari panggung.',
      start_date: dto.start_date,
      end_date: dto.end_date,
      capacity: dto.capacity ? Number(dto.capacity) : 4700,
      banner_url:
        dto.banner_url ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
      status: ['draft', 'published'].includes(dto.status || '') ? dto.status! : 'draft',
      price_min: 350000,
      price_max: 1800000,
      guest_stars: dto.guest_stars,
      venue_map_url: dto.venue_map_url,
      poster_url: dto.poster_url,
      terms_conditions: dto.terms_conditions,
      sale_start_at: dto.sale_start_at,
      sale_end_at: dto.sale_end_at,
    };

    eventRepository.create(newEvent);

    // Seed default ticket tiers
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

    for (const tier of defaultTiers) {
      eventRepository.addTier(tier);
    }
    this.recalculateEventPrices(newEvent.id);

    return newEvent;
  }

  /**
   * Update existing event
   */
  public updateEvent(
    id: string,
    organizerId: string,
    role: string,
    body: Record<string, any>
  ): { status: number; message?: string; data?: DemoEvent } {
    const event = eventRepository.findById(id);
    if (!event) return { status: 404, message: 'Event not found' };

    if (role === 'organizer' && event.organizer_id !== organizerId) {
      return { status: 403, message: 'You can only edit your own events' };
    }

    const allowed = [
      'name',
      'description',
      'category',
      'location',
      'venue_name',
      'venue_layout_info',
      'start_date',
      'end_date',
      'capacity',
      'banner_url',
      'status',
      'guest_stars',
      'venue_map_url',
      'poster_url',
      'terms_conditions',
      'sale_start_at',
      'sale_end_at',
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        (event as any)[key] = body[key];
      }
    }

    return { status: 200, data: event };
  }

  /**
   * Soft delete event
   */
  public deleteEvent(
    id: string,
    organizerId: string,
    role: string
  ): { status: number; message?: string } {
    const event = eventRepository.findById(id);
    if (!event) return { status: 404, message: 'Event not found' };

    if (role === 'organizer' && event.organizer_id !== organizerId) {
      return { status: 403, message: 'You can only delete your own events' };
    }

    eventRepository.softDelete(id);
    return { status: 200 };
  }

  /**
   * Update event banner
   */
  public updateBanner(
    id: string,
    organizerId: string,
    role: string,
    bannerUrl: string
  ): { status: number; message?: string; banner_url?: string } {
    const event = eventRepository.findById(id);
    if (!event) return { status: 404, message: 'Event not found' };

    if (role === 'organizer' && event.organizer_id !== organizerId) {
      return { status: 403, message: 'Forbidden' };
    }

    event.banner_url = bannerUrl;
    return { status: 200, banner_url: bannerUrl };
  }

  /**
   * Add or update ticket tier
   */
  public upsertTicketTier(
    eventId: string,
    organizerId: string,
    role: string,
    data: {
      tierId?: string;
      name: string;
      description?: string;
      price: number;
      quota: number;
      color?: string;
      sort_order?: number;
    }
  ): { status: number; message?: string; data?: DemoTicketTier } {
    const event = eventRepository.findById(eventId);
    if (!event) return { status: 404, message: 'Event not found' };

    if (role === 'organizer' && event.organizer_id !== organizerId) {
      return { status: 403, message: 'Forbidden' };
    }

    const { tierId, name, description, price, quota, color, sort_order } = data;
    const tiers = eventRepository.getTiersByEventId(eventId);
    let tier = tierId ? tiers.find((t) => t.id === tierId) : undefined;

    if (tier) {
      tier.name = name;
      tier.description = description || tier.description;
      tier.price = Number(price);
      tier.quota = Number(quota);
      tier.color = color || tier.color;
      if (sort_order !== undefined) tier.sort_order = Number(sort_order);
    } else {
      const newTier: DemoTicketTier = {
        id: `tier-${eventId}-${uuidv4().slice(0, 6)}`,
        event_id: eventId,
        name,
        description: description || '',
        price: Number(price),
        quota: Number(quota),
        sold: 0,
        color: color || '#6366F1',
        sort_order: sort_order ? Number(sort_order) : tiers.length + 1,
      };
      tier = newTier;
      eventRepository.addTier(newTier);
    }

    this.recalculateEventPrices(eventId);
    return { status: 200, data: tier };
  }

  /**
   * Delete ticket tier
   */
  public deleteTicketTier(
    eventId: string,
    tierId: string,
    organizerId: string,
    role: string
  ): { status: number; message?: string } {
    const event = eventRepository.findById(eventId);
    if (!event) return { status: 404, message: 'Event not found' };

    if (role === 'organizer' && event.organizer_id !== organizerId) {
      return { status: 403, message: 'Forbidden' };
    }

    const deleted = eventRepository.removeTierById(tierId);
    if (!deleted) return { status: 404, message: 'Ticket tier not found' };

    this.recalculateEventPrices(eventId);
    return { status: 200 };
  }

  /**
   * List organizer's own events
   */
  public listMyEvents(
    organizerId: string,
    tenantId: string,
    status?: string
  ): any[] {
    let result = dataStore.events.filter(
      (e) =>
        e.organizer_id === organizerId &&
        e.tenant_id === tenantId &&
        e.status !== 'deleted'
    );

    if (status && typeof status === 'string') {
      result = result.filter((e) => e.status === status);
    }

    return result.map((e) => {
      const eventTiers = eventRepository.getTiersByEventId(e.id);
      const totalQuota = eventTiers.reduce((sum, t) => sum + t.quota, 0);
      const totalSold = eventTiers.reduce((sum, t) => sum + t.sold, 0);
      return {
        ...e,
        stats: {
          total_seats: totalQuota,
          sold_seats: totalSold,
          available_seats: totalQuota - totalSold,
          sold_percent: totalQuota > 0 ? Math.round((totalSold / totalQuota) * 100) : 0,
        },
      };
    });
  }

  /**
   * Staff Management
   */
  public listEventStaff(eventId: string) {
    const eventStaffs = dataStore.eventStaff.filter((es) => es.event_id === eventId);
    return eventStaffs.map((es) => {
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
  }

  public getStaffFeeStatus(
    eventId: string,
    organizerId: string,
    role: string
  ): { status: number; message?: string; data?: any } {
    const event = dataStore.events.find((e) => e.id === eventId);
    if (!event) return { status: 404, message: 'Event tidak ditemukan' };
    if (role === 'organizer' && event.organizer_id !== organizerId) {
      return { status: 403, message: 'Forbidden' };
    }
    return {
      status: 200,
      data: {
        event_id: event.id,
        event_name: event.name,
        staff_fee_paid: Boolean(event.staff_fee_paid),
        fee_amount: 50000,
      },
    };
  }

  public async createStaffFeeOrder(
    eventId: string,
    organizerId: string,
    tenantId: string,
    customerEmail?: string,
    customerName?: string
  ): Promise<{ status: number; message?: string; data?: any }> {
    const event = dataStore.events.find((e) => e.id === eventId);
    if (!event) return { status: 404, message: 'Event tidak ditemukan' };
    if (event.organizer_id !== organizerId) return { status: 403, message: 'Forbidden' };
    if (event.staff_fee_paid) {
      return { status: 200, data: { already_paid: true, staff_fee_paid: true } };
    }

    const orderId = `SFEE-${eventId}-${Date.now().toString().slice(-6)}`;
    const grossAmount = 50000;

    let snapToken = `MOCK-SNAP-SFEE-${orderId}`;
    let snapRedirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;

    if (env.MIDTRANS_SERVER_KEY) {
      try {
        const snapRes = await createMidtransSnapToken({
          orderId,
          grossAmount,
          customerName: customerName || 'Organizer',
          customerEmail: customerEmail || 'organizer@whitelabel.id',
          itemDetails: [
            {
              id: 'SAAS-STAFF-FEE',
              name: `Aktivasi Staff & Vendor - ${event.name.slice(0, 25)}`,
              price: grossAmount,
              quantity: 1,
            },
          ],
        });
        snapToken = snapRes.token;
        snapRedirectUrl = snapRes.redirect_url;
      } catch (err: any) {
        logger.warn(`[StaffFee] Midtrans Snap creation failed: ${err.message}`);
      }
    }

    return {
      status: 200,
      data: {
        order_id: orderId,
        event_id: event.id,
        gross_amount: grossAmount,
        snap_token: snapToken,
        redirect_url: snapRedirectUrl,
      },
    };
  }

  public confirmStaffFee(
    eventId: string,
    organizerId: string
  ): { status: number; message?: string; data?: any } {
    const event = dataStore.events.find((e) => e.id === eventId);
    if (!event) return { status: 404, message: 'Event tidak ditemukan' };
    if (event.organizer_id !== organizerId) return { status: 403, message: 'Forbidden' };
    event.staff_fee_paid = true;
    return { status: 200, data: { event_id: event.id, staff_fee_paid: true } };
  }

  public addEventStaff(
    eventId: string,
    tenantId: string,
    organizerId: string,
    data: { name: string; email: string; password: string; role?: string }
  ): { status: number; message?: string; data?: any } {
    const event = dataStore.events.find((e) => e.id === eventId);
    if (!event) {
      return { status: 404, message: 'Event tidak ditemukan' };
    }

    if (!event.staff_fee_paid) {
      return {
        status: 402,
        message:
          'Pembayaran aktivasi penugasan staff (SaaS Event Staff Fee) diperlukan sebelum menambahkan Gate Staff atau Vendor untuk event ini.',
      };
    }

    const { name, email, password, role = 'gate_staff' } = data;

    let user = dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      user = {
        id: `user-${crypto.randomUUID().slice(0, 8)}`,
        tenant_id: tenantId || 'tenant-001',
        name,
        email,
        password_hash: password,
        role: role === 'vendor' ? 'vendor' : 'gate_staff',
        approval_status: 'approved',
        invited_by_organizer_id: organizerId,
      };
      dataStore.users.push(user);
    }

    const existingAssigned = dataStore.eventStaff.find(
      (es) => es.event_id === eventId && es.user_id === user!.id
    );

    if (existingAssigned) {
      return { status: 409, message: 'Akun ini sudah ditugaskan pada event ini' };
    }

    const newAssigned = {
      id: `evtstaff-${crypto.randomUUID().slice(0, 8)}`,
      event_id: eventId,
      user_id: user.id,
      role: (role === 'vendor' ? 'vendor' : 'gate_staff') as 'gate_staff' | 'vendor',
      assigned_at: new Date().toISOString(),
    };

    dataStore.eventStaff.push(newAssigned);

    return {
      status: 201,
      data: {
        id: newAssigned.id,
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: newAssigned.role,
        assigned_at: newAssigned.assigned_at,
      },
    };
  }

  public removeEventStaff(eventId: string, userId: string): { status: number; message?: string } {
    const idx = dataStore.eventStaff.findIndex(
      (es) => es.event_id === eventId && (es.user_id === userId || es.id === userId)
    );

    if (idx === -1) {
      return { status: 404, message: 'Staff tidak ditemukan pada event ini' };
    }

    dataStore.eventStaff.splice(idx, 1);
    return { status: 200 };
  }

  /**
   * Multi-Day Sessions
   */
  public listEventSessions(eventId: string): DemoEventSession[] {
    return eventRepository.getSessionsByEventId(eventId);
  }

  public createEventSession(eventId: string, dto: EventSessionDto): { status: number; message?: string; data?: DemoEventSession } {
    const event = eventRepository.findById(eventId);
    if (!event) {
      return { status: 404, message: 'Event tidak ditemukan' };
    }

    const session: DemoEventSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      event_id: eventId,
      name: dto.name,
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      description: dto.description || '',
      sort_order: dto.sort_order ?? ((dataStore.eventSessions?.filter((s) => s.event_id === eventId).length || 0) + 1),
    };

    eventRepository.addSession(session);
    return { status: 201, data: session };
  }

  public updateEventSession(
    eventId: string,
    sessionId: string,
    dto: UpdateEventSessionDto
  ): { status: number; message?: string; data?: DemoEventSession } {
    const session = eventRepository.findSessionById(sessionId);
    if (!session || session.event_id !== eventId) {
      return { status: 404, message: 'Sesi event tidak ditemukan' };
    }

    const updated = eventRepository.updateSession(sessionId, dto);
    return { status: 200, data: updated! };
  }

  public deleteEventSession(eventId: string, sessionId: string): { status: number; message?: string } {
    const session = eventRepository.findSessionById(sessionId);
    if (!session || session.event_id !== eventId) {
      return { status: 404, message: 'Sesi event tidak ditemukan' };
    }

    eventRepository.removeSession(sessionId);
    return { status: 200, message: 'Sesi berhasil dihapus' };
  }
}

export const eventService = new EventService();
