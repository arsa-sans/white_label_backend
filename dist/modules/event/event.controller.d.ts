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
import { z } from 'zod';
export declare const createEventSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    location: z.ZodString;
    venue_name: z.ZodOptional<z.ZodString>;
    start_date: z.ZodString;
    end_date: z.ZodString;
    capacity: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>>;
    banner_url: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        published: "published";
        draft: "draft";
        ended: "ended";
    }>>;
}, z.core.$strip>;
export declare const upsertSeatCategorySchema: z.ZodObject<{
    catId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    price: z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>;
    rows: z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>]>;
    cols: z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>;
    color: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare function listEvents(req: Request, res: Response): Promise<void>;
export declare function listAllEvents(req: Request, res: Response): Promise<void>;
export declare function getEventById(req: Request, res: Response): Promise<void>;
export declare function getEventSeats(req: Request, res: Response): Promise<void>;
export declare function createEvent(req: Request, res: Response): Promise<void>;
export declare function updateEvent(req: Request, res: Response): Promise<void>;
export declare function deleteEvent(req: Request, res: Response): Promise<void>;
export declare function uploadBanner(req: Request, res: Response): Promise<void>;
export declare function listSeatCategories(req: Request, res: Response): Promise<void>;
export declare function upsertSeatCategory(req: Request, res: Response): Promise<void>;
export declare function deleteSeatCategory(req: Request, res: Response): Promise<void>;
export declare function regenerateSeats(req: Request, res: Response): Promise<void>;
export declare function listMyEvents(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=event.controller.d.ts.map