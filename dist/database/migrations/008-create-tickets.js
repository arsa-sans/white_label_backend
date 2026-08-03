"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('tickets', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        event_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'events', key: 'id' },
            onDelete: 'RESTRICT',
        },
        seat_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'seats', key: 'id' },
            onDelete: 'RESTRICT',
        },
        user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'RESTRICT',
        },
        order_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'orders', key: 'id' },
            onDelete: 'RESTRICT',
        },
        // SKILLS.md §3: random 32-byte seed, stored at ticket issuance (order.paid)
        // Used to derive time-windowed AES-encrypted QR tokens — never sent raw to client
        qr_seed: {
            type: sequelize_1.DataTypes.STRING(64), // 32 bytes hex-encoded
            allowNull: false,
            unique: true,
        },
        status: {
            type: sequelize_1.DataTypes.ENUM('valid', 'used', 'void', 'refunded'),
            allowNull: false,
            defaultValue: 'valid',
        },
        issued_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
        },
        used_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        used_gate_device_id: {
            type: sequelize_1.DataTypes.UUID,
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
    // REQUIRED index (spec): gate validation looks up qr_seed during scan
    await queryInterface.addIndex('tickets', ['qr_seed'], {
        unique: true,
        name: 'tickets_qr_seed_idx',
    });
    await queryInterface.addIndex('tickets', ['event_id', 'status']);
    await queryInterface.addIndex('tickets', ['user_id']);
    await queryInterface.addIndex('tickets', ['order_id']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('tickets');
}
//# sourceMappingURL=008-create-tickets.js.map