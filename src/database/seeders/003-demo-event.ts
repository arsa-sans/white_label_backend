import { QueryInterface } from 'sequelize';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ORGANIZER_ID = '00000000-0000-0000-0001-000000000002';

export const EVENT_ID = '00000000-0000-0000-0002-000000000001';
export const VENUE_ID = '00000000-0000-0000-0003-000000000001';

const startDate = new Date();
startDate.setDate(startDate.getDate() + 30); // 30 days from now
const endDate = new Date(startDate);
endDate.setHours(endDate.getHours() + 8); // 8-hour event

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkInsert('events', [
    {
      id: EVENT_ID,
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
      id: VENUE_ID,
      event_id: EVENT_ID,
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

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('venues', { event_id: EVENT_ID } as Record<string, unknown>);
  await queryInterface.bulkDelete('events', { id: EVENT_ID } as Record<string, unknown>);
}
