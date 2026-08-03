"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('users', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        tenant_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE',
        },
        name: {
            type: sequelize_1.DataTypes.STRING(200),
            allowNull: false,
        },
        email: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
        },
        password_hash: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: true, // null for OAuth-only users
        },
        role: {
            type: sequelize_1.DataTypes.ENUM('visitor', 'organizer', 'gate_staff', 'vendor', 'admin', 'superadmin'),
            allowNull: false,
            defaultValue: 'visitor',
        },
        mfa_secret: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: true,
        },
        mfa_enabled: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        is_verified: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        verification_token: {
            type: sequelize_1.DataTypes.STRING(128),
            allowNull: true,
        },
        refresh_token_hash: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: true,
        },
        last_login_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        created_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
        },
        updated_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
        },
    });
    // UNIQUE composite: one email per tenant
    await queryInterface.addIndex('users', ['tenant_id', 'email'], {
        unique: true,
        name: 'users_tenant_email_unique',
    });
    await queryInterface.addIndex('users', ['tenant_id', 'role']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('users');
}
//# sourceMappingURL=002-create-users.js.map