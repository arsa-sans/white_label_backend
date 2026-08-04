/**
 * src/modules/event/event.routes.ts
 *
 * Route definitions for Event Service (Phase 3)
 *
 * Public (no auth):
 *   GET /events              — catalog with search/filter/pagination
 *   GET /events/:id          — event detail + stats
 *   GET /events/:id/seats    — seat map
 *
 * Organizer + Admin:
 *   GET    /events/me                              — organizer's own events
 *   POST   /events                                 — create event
 *   PUT    /events/:id                             — update event
 *   DELETE /events/:id                             — soft-delete event
 *   POST   /events/:id/banner                      — update banner URL
 *   GET    /events/:id/seat-categories             — list seat categories
 *   POST   /events/:id/seat-categories             — add/update seat category
 *   DELETE /events/:id/seat-categories/:catId      — remove seat category
 *   POST   /events/:id/regenerate-seats            — rebuild seat layout
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
  getEventSeats,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadBanner,
  listSeatCategories,
  upsertSeatCategory,
  deleteSeatCategory,
  regenerateSeats,
} from './event.controller';

const router = Router();

/* ── public routes ───────────────────────────────────────── */
router.get('/', listEvents);
router.get('/:id/seats', getEventSeats);

/* ── admin-only ─────────────────────────────────────────── */
router.get(
  '/admin/all',
  authenticate,
  requireRole(['admin', 'superadmin']),
  listAllEvents
);

/* ── organizer / admin shared ───────────────────────────── */
router.get('/me', authenticate, requireRole(['organizer', 'admin']), listMyEvents);

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


router.get(
  '/:id/seat-categories',
  authenticate,
  requireRole(['organizer', 'admin']),
  listSeatCategories
);

router.post(
  '/:id/seat-categories',
  authenticate,
  requireRole(['organizer', 'admin']),
  upsertSeatCategory
);

router.delete(
  '/:id/seat-categories/:catId',
  authenticate,
  requireRole(['organizer', 'admin']),
  deleteSeatCategory
);

router.post(
  '/:id/regenerate-seats',
  authenticate,
  requireRole(['organizer', 'admin']),
  regenerateSeats
);

/* ── public detail (must come after static paths above) ──── */
router.get('/:id', getEventById);

export default router;
