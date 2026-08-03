"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
async function up(queryInterface) {
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
async function down(queryInterface) {
    await queryInterface.bulkDelete('tenants', { id: TENANT_ID });
}
//# sourceMappingURL=001-demo-tenant.js.map