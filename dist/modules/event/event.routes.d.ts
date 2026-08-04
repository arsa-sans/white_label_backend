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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=event.routes.d.ts.map