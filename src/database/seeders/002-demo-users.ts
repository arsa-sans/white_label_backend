import { QueryInterface } from 'sequelize';
import argon2 from 'argon2';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const users = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    role: 'admin',
    name: 'Admin Demo',
    email: 'admin@demo.wl',
    password: 'Admin@123456',
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    role: 'organizer',
    name: 'Organizer Demo',
    email: 'organizer@demo.wl',
    password: 'Organizer@123456',
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    role: 'gate_staff',
    name: 'Gate Staff Demo',
    email: 'gate@demo.wl',
    password: 'Gate@123456',
  },
  {
    id: '00000000-0000-0000-0001-000000000004',
    role: 'visitor',
    name: 'Visitor Demo',
    email: 'visitor@demo.wl',
    password: 'Visitor@123456',
  },
  {
    id: '00000000-0000-0000-0001-000000000005',
    role: 'vendor',
    name: 'Vendor Demo',
    email: 'vendor@demo.wl',
    password: 'Vendor@123456',
  },
];

export async function up(queryInterface: QueryInterface): Promise<void> {
  const rows = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      tenant_id: TENANT_ID,
      name: u.name,
      email: u.email,
      // Argon2id hash — never store plaintext
      password_hash: await argon2.hash(u.password, { type: argon2.argon2id }),
      role: u.role,
      mfa_secret: null,
      mfa_enabled: false,
      is_verified: true,
      verification_token: null,
      refresh_token_hash: null,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }))
  );

  await queryInterface.bulkInsert('users', rows);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('users', {
    tenant_id: TENANT_ID,
  } as Record<string, unknown>);
}
