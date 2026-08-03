import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkInsert('tenants', [
    {
      id: TENANT_ID,
      name: 'Demo Tenant',
      subdomain: 'demo',
      custom_domain: null,
      logo_url: null,
      favicon_url: null,
      primary_color: '#4F46E5',
      secondary_color: '#06B6D4',
      font_family: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('tenants', { id: TENANT_ID } as Record<string, unknown>);
}
