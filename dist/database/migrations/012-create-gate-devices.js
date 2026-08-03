"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('gate_devices', {
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
            onDelete: 'CASCADE',
        },
        staff_user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
        },
        device_name: {
            type: sequelize_1.DataTypes.STRING(200),
            allowNull: false,
        },
        // Per-device HMAC secret for offline validation (SKILLS.md §4)
        // Stored server-side only, sent to device during pre-sync (encrypted)
        device_hmac_secret: {
            type: sequelize_1.DataTypes.STRING(128),
            allowNull: true,
        },
        last_sync_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        is_active: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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
    await queryInterface.addIndex('gate_devices', ['event_id', 'is_active']);
    await queryInterface.addIndex('gate_devices', ['staff_user_id']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('gate_devices');
}
//# sourceMappingURL=012-create-gate-devices.js.map