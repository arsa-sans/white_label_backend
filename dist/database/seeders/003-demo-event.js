"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VENUE_ID = exports.EVENT_ID = void 0;
exports.up = up;
exports.down = down;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ORGANIZER_ID = '00000000-0000-0000-0001-000000000002';
exports.EVENT_ID = '00000000-0000-0000-0002-000000000001';
exports.VENUE_ID = '00000000-0000-0000-0003-000000000001';
const startDate = new Date();
startDate.setDate(startDate.getDate() + 30); // 30 days from now
const endDate = new Date(startDate);
endDate.setHours(endDate.getHours() + 8); // 8-hour event
async function up(queryInterface) {
    await queryInterface.bulkInsert('events', [
        {
            id: exports.EVENT_ID,
            tenant_id: TENANT_ID,
            organizer_id: ORGANIZER_ID,
            name: 'Demo Music Festival 2026',
            slug: 'demo-music-festival-2026',
            description: 'A demo event for development and testing purposes.',
            location: 'Jakarta Convention Center, Jakarta',
            venue_map_url: null,
            banner_url: null,
            start_date: startDate,
            end_date: endDate,
            capacity: 20, // matches the 20 seats created in seeder 004
            status: 'on_sale',
            is_flash_sale: false,
            category: 'Music',
            tags: JSON.stringify(['music', 'festival', 'demo']),
            created_at: new Date(),
            updated_at: new Date(),
        },
    ]);
    await queryInterface.bulkInsert('venues', [
        {
            id: exports.VENUE_ID,
            event_id: exports.EVENT_ID,
            name: 'Main Stage Area',
            layout_json: JSON.stringify({
                sections: [
                    { id: 'vip', name: 'VIP', rows: 2, cols: 5, seatPrefix: 'V' },
                    { id: 'regular', name: 'Regular', rows: 2, cols: 5, seatPrefix: 'R' },
                ],
            }),
            created_at: new Date(),
            updated_at: new Date(),
        },
    ]);
}
async function down(queryInterface) {
    await queryInterface.bulkDelete('venues', { event_id: exports.EVENT_ID });
    await queryInterface.bulkDelete('events', { id: exports.EVENT_ID });
}
//# sourceMappingURL=003-demo-event.js.map