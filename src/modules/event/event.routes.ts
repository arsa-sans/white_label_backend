/**
 * src/modules/event/event.routes.ts
 *
 * Route definitions for Event Service (Phase 3 — Ticket Tier Based)
 *
 * Public (no auth):
 *   GET /events              — catalog with search/filter/pagination
 *   GET /events/:id          — event detail + tier stats
 *   GET /events/:id/tiers    — ticket tiers list with quota
 *
 * Organizer + Admin:
 *   GET    /events/me                       — organizer's own events
 *   POST   /events                          — create event
 *   PUT    /events/:id                      — update event
 *   DELETE /events/:id                      — soft-delete event
 *   POST   /events/:id/banner               — update banner URL
 *   POST   /events/:id/tiers                — add/update ticket tier
 *   DELETE /events/:id/tiers/:tierId        — remove ticket tier
 *   GET    /events/:id/staff                — list event staff
 *   POST   /events/:id/staff                — assign gate staff/vendor
 *   DELETE /events/:id/staff/:userId        — remove staff
 *
 * Admin only:
 *   GET /events/admin/all   — all events across tenants
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import { uploadBannerMiddleware } from '../../middlewares/upload.middleware';
import {
  listEvents,
  listAllEvents,
  listMyEvents,
  getEventById,
  listTicketTiers,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadBanner,
  upsertTicketTier,
  deleteTicketTier,
  listEventStaff,
  addEventStaff,
  removeEventStaff,
} from './event.controller';

const router = Router();

/* ── public routes ───────────────────────────────────────── */
router.get('/', listEvents);
router.get('/:id/tiers', listTicketTiers);

/* ── admin-only ─────────────────────────────────────────── */
router.get(
  '/admin/all',
  authenticate,
  requireRole(['admin', 'superadmin']),
  listAllEvents
);

/* ── organizer / admin shared ───────────────────────────── */
router.get('/me', authenticate, requireRole(['organizer', 'admin']), listMyEvents);

/* ── staff management routes (must come before /:id) ────── */
router.get(
  '/:id/staff',
  authenticate,
  requireRole(['organizer', 'admin']),
  listEventStaff
);

router.post(
  '/:id/staff',
  authenticate,
  requireRole(['organizer', 'admin']),
  addEventStaff
);

router.delete(
  '/:id/staff/:userId',
  authenticate,
  requireRole(['organizer', 'admin']),
  removeEventStaff
);

router.post(
  '/',
  authenticate,
  requireRole(['organizer', 'admin']),
  createEvent
);

router.put(
  '/:id',
  authenticate,
  requireRole(['organizer', 'admin']),
  updateEvent
);

router.delete(
  '/:id',
  authenticate,
  requireRole(['organizer', 'admin']),
  deleteEvent
);

router.post(
  '/:id/banner',
  authenticate,
  requireRole(['organizer', 'admin']),
  uploadBannerMiddleware.single('banner'),
  uploadBanner
);

router.post(
  '/:id/tiers',
  authenticate,
  requireRole(['organizer', 'admin']),
  upsertTicketTier
);

router.delete(
  '/:id/tiers/:tierId',
  authenticate,
  requireRole(['organizer', 'admin']),
  deleteTicketTier
);

/* ── public detail (must come after static paths above) ──── */
router.get('/:id', getEventById);

export default router;
