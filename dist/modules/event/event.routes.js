"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const upload_middleware_1 = require("../../middlewares/upload.middleware");
const event_controller_1 = require("./event.controller");
const router = (0, express_1.Router)();
/* ── public routes ───────────────────────────────────────── */
router.get('/', event_controller_1.listEvents);
router.get('/:id/seats', event_controller_1.getEventSeats);
/* ── admin-only ─────────────────────────────────────────── */
router.get('/admin/all', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['admin', 'superadmin']), event_controller_1.listAllEvents);
/* ── organizer / admin shared ───────────────────────────── */
router.get('/me', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.listMyEvents);
router.post('/', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.createEvent);
router.put('/:id', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.updateEvent);
router.delete('/:id', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.deleteEvent);
router.post('/:id/banner', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), upload_middleware_1.uploadBannerMiddleware.single('banner'), event_controller_1.uploadBanner);
router.get('/:id/seat-categories', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.listSeatCategories);
router.post('/:id/seat-categories', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.upsertSeatCategory);
router.delete('/:id/seat-categories/:catId', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.deleteSeatCategory);
router.post('/:id/regenerate-seats', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), event_controller_1.regenerateSeats);
/* ── public detail (must come after static paths above) ──── */
router.get('/:id', event_controller_1.getEventById);
exports.default = router;
//# sourceMappingURL=event.routes.js.map