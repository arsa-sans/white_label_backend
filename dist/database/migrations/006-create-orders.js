"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('orders', {
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
        user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'RESTRICT',
        },
        event_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'events', key: 'id' },
            onDelete: 'RESTRICT',
        },
        amount: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        status: {
            type: sequelize_1.DataTypes.ENUM('pending', 'paid', 'failed', 'expired', 'refunded'),
            allowNull: false,
            defaultValue: 'pending',
        },
        // SKILLS.md §2: UNIQUE constraint at DB level — not just application level
        idempotency_key: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        payment_gateway: {
            type: sequelize_1.DataTypes.STRING(50),
            allowNull: true, // e.g. "midtrans", "xendit"
        },
        gateway_ref: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: true, // transaction ID from gateway (2nd idempotency key)
        },
        gateway_payload: {
            type: sequelize_1.DataTypes.JSON,
            allowNull: true, // full webhook payload for audit
        },
        expires_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        paid_at: {
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
    // REQUIRED index (SKILLS.md §2): idempotency_key lookup must be instant
    await queryInterface.addIndex('orders', ['idempotency_key'], {
        unique: true,
        name: 'orders_idempotency_key_idx',
    });
    await queryInterface.addIndex('orders', ['gateway_ref'], {
        name: 'orders_gateway_ref_idx',
    });
    await queryInterface.addIndex('orders', ['tenant_id', 'status']);
    await queryInterface.addIndex('orders', ['user_id', 'status']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('orders');
}
//# sourceMappingURL=006-create-orders.js.map