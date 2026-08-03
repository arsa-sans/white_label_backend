"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('gate_scan_logs', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        ticket_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'tickets', key: 'id' },
            onDelete: 'RESTRICT',
        },
        gate_device_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true, // may be null for manually entered scans
            references: { model: 'gate_devices', key: 'id' },
            onDelete: 'SET NULL',
        },
        scanned_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
        },
        // SKILLS.md §4: offline logs are 'pending', pushed to server in background
        sync_status: {
            type: sequelize_1.DataTypes.ENUM('synced', 'pending'),
            allowNull: false,
            defaultValue: 'synced',
        },
        result: {
            type: sequelize_1.DataTypes.ENUM('valid', 'invalid', 'duplicate', 'expired', 'duplicate_conflict'),
            allowNull: false,
        },
        // Raw QR token scanned (for forensics, stored encrypted in prod)
        qr_token_preview: {
            type: sequelize_1.DataTypes.STRING(32),
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
    // REQUIRED index (spec)
    await queryInterface.addIndex('gate_scan_logs', ['ticket_id'], {
        name: 'gate_scan_logs_ticket_id_idx',
    });
    await queryInterface.addIndex('gate_scan_logs', ['gate_device_id', 'sync_status']);
    await queryInterface.addIndex('gate_scan_logs', ['scanned_at']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('gate_scan_logs');
}
//# sourceMappingURL=013-create-gate-scan-logs.js.map