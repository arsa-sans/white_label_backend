import { QueryInterface } from 'sequelize';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // 1. Seed Tenant
  await queryInterface.bulkInsert('tenants', [
    {
      id: TENANT_ID,
      name: 'Soundwave Festival 2026',
      subdomain: 'soundwave',
      custom_domain: null,
      logo_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
      favicon_url: null,
      primary_color: '#4F46E5',
      secondary_color: '#06B6D4',
      font_family: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // 2. Seed Users
  const passwordHash = await argon2.hash('Organizer@2026!', { type: argon2.argon2id });
  const adminPasswordHash = await argon2.hash('Admin@2026!', { type: argon2.argon2id });

  const users = [
    {
      id: '00000000-0000-0000-0001-000000000001',
      tenant_id: TENANT_ID,
      role: 'admin',
      name: 'Admin Soundwave',
      email: 'admin@whitelabel.id',
      password_hash: adminPasswordHash,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '00000000-0000-0000-0001-000000000002',
      tenant_id: TENANT_ID,
      role: 'organizer',
      name: 'Elena Rostova',
      email: 'organizer@soundwave.com',
      password_hash: passwordHash,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '00000000-0000-0000-0001-000000000003',
      tenant_id: TENANT_ID,
      role: 'gate_staff',
      name: 'Rudi Gate Staff',
      email: 'gate@soundwave.com',
      password_hash: passwordHash,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '00000000-0000-0000-0001-000000000004',
      tenant_id: TENANT_ID,
      role: 'visitor',
      name: 'Budi Santoso',
      email: 'budi@gmail.com',
      password_hash: passwordHash,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '00000000-0000-0000-0001-000000000005',
      tenant_id: TENANT_ID,
      role: 'vendor',
      name: 'Vendor Food & Beverage',
      email: 'vendor@demo.wl',
      password_hash: passwordHash,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  await queryInterface.bulkInsert('users', users);

  // 3. Seed Events
  const eventId = '00000000-0000-0000-0002-000000000001';
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 8);

  await queryInterface.bulkInsert('events', [
    {
      id: eventId,
      tenant_id: TENANT_ID,
      organizer_id: '00000000-0000-0000-0001-000000000002', // Related to Elena Rostova
      name: 'Neon Genesis Music Festival 2026',
      slug: 'neon-genesis-music-festival-2026',
      description: 'Pertunjukan musik elektronik terbesar di Asia Tenggara menampilkan DJ kelas dunia.',
      location: 'JIExpo Kemayoran, Jakarta',
      venue_map_url: null,
      banner_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
      start_date: startDate,
      end_date: endDate,
      capacity: 4700,
      status: 'published',
      is_flash_sale: false,
      category: 'Concert',
      tags: JSON.stringify(['music', 'festival', 'edm']),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('events', { tenant_id: TENANT_ID } as Record<string, unknown>);
  await queryInterface.bulkDelete('users', { tenant_id: TENANT_ID } as Record<string, unknown>);
  await queryInterface.bulkDelete('tenants', { id: TENANT_ID } as Record<string, unknown>);
}
