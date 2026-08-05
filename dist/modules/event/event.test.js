"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../app"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
function generateTestToken(role = 'organizer', userId = 'user-organizer-1', tenantId = 'tenant-001') {
    return jsonwebtoken_1.default.sign({
        userId,
        tenantId,
        email: `${role}@test.com`,
        role,
    }, env_1.env.JWT_SECRET, { expiresIn: '1h' });
}
describe('Phase 3 — Event Service API', () => {
    const organizerToken = generateTestToken('organizer');
    const visitorToken = generateTestToken('visitor');
    let createdEventId;
    describe('GET /api/v1/events (Public Catalog)', () => {
        it('should return paginated list of published events', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/events')
                .set('x-tenant-id', 'tenant-001');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.meta).toBeDefined();
        });
        it('should filter events by category and search query', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/events?search=Neon&category=Concert')
                .set('x-tenant-id', 'tenant-001');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data[0].name).toContain('Neon');
        });
        it('should return event details by ID with stats', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/events/evt-001')
                .set('x-tenant-id', 'tenant-001');
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe('evt-001');
            expect(res.body.data.stats).toBeDefined();
            expect(res.body.data.stats.total_seats).toBeGreaterThan(0);
        });
        it('should return seat map for event', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/v1/events/evt-001/seats')
                .set('x-tenant-id', 'tenant-001');
            expect(res.status).toBe(200);
            expect(res.body.data.seats).toBeDefined();
            expect(Array.isArray(res.body.data.seats)).toBe(true);
        });
    });
    describe('POST /api/v1/events (Organizer CRUD)', () => {
        it('should reject creation without auth token', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/events')
                .set('x-tenant-id', 'tenant-001')
                .send({ name: 'Unauthorized Event' });
            expect(res.status).toBe(401);
        });
        it('should reject creation if user is visitor', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/events')
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${visitorToken}`)
                .send({
                name: 'Visitor Festival 2026',
                location: 'Jakarta',
                start_date: '2026-12-01T10:00:00Z',
                end_date: '2026-12-01T22:00:00Z',
            });
            expect(res.status).toBe(403);
        });
        it('should allow organizer to create a new event', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/events')
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`)
                .send({
                name: 'Summer Electro Bash 2026',
                description: 'Outdoor summer EDM concert',
                category: 'Concert',
                location: 'Ancol Beach, Jakarta',
                venue_name: 'Beach Stage',
                start_date: '2026-12-10T16:00:00Z',
                end_date: '2026-12-10T23:00:00Z',
                capacity: 5000,
                status: 'published',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Summer Electro Bash 2026');
            createdEventId = res.body.data.id;
        });
        it('should allow organizer to update event details', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .put(`/api/v1/events/${createdEventId}`)
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`)
                .send({
                name: 'Summer Electro Bash 2026 (Updated)',
            });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Summer Electro Bash 2026 (Updated)');
        });
        it('should allow banner upload (URL input)', async () => {
            const bannerUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819';
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/events/${createdEventId}/banner`)
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`)
                .send({ banner_url: bannerUrl });
            expect(res.status).toBe(200);
            expect(res.body.data.banner_url).toBe(bannerUrl);
        });
    });
    describe('Seat Categories & Rebuild Layout', () => {
        it('should list seat categories for an event', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/events/${createdEventId}/seat-categories`)
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
        it('should add a new seat category (VVIP)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/events/${createdEventId}/seat-categories`)
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`)
                .send({
                name: 'VVIP Royal',
                price: 3000000,
                rows: ['S1', 'S2'],
                cols: 5,
                color: '#F59E0B',
            });
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('VVIP Royal');
        });
        it('should regenerate seat map layout', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/events/${createdEventId}/regenerate-seats`)
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total_seats).toBeGreaterThan(0);
        });
    });
    describe('DELETE /api/v1/events/:id', () => {
        it('should soft delete event status to deleted', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/events/${createdEventId}`)
                .set('x-tenant-id', 'tenant-001')
                .set('Authorization', `Bearer ${organizerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(createdEventId);
            // Verify event is soft-deleted
            const detailRes = await (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/events/${createdEventId}`)
                .set('x-tenant-id', 'tenant-001');
            expect(detailRes.status).toBe(404);
        });
    });
});
//# sourceMappingURL=event.test.js.map