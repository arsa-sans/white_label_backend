"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const argon2_1 = __importDefault(require("argon2"));
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
async function up(queryInterface) {
    const rows = await Promise.all(users.map(async (u) => ({
        id: u.id,
        tenant_id: TENANT_ID,
        name: u.name,
        email: u.email,
        // Argon2id hash — never store plaintext
        password_hash: await argon2_1.default.hash(u.password, { type: argon2_1.default.argon2id }),
        role: u.role,
        mfa_secret: null,
        mfa_enabled: false,
        is_verified: true,
        verification_token: null,
        refresh_token_hash: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
    })));
    await queryInterface.bulkInsert('users', rows);
}
async function down(queryInterface) {
    await queryInterface.bulkDelete('users', {
        tenant_id: TENANT_ID,
    });
}
//# sourceMappingURL=002-demo-users.js.map