"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('audit_logs', {
        id: {
            type: sequelize_1.DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        tenant_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true, // null for platform-level actions (superadmin)
            references: { model: 'tenants', key: 'id' },
            onDelete: 'SET NULL',
        },
        actor_user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true, // null for system/automated actions
        },
        action: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
            // e.g. "order.create", "seat.lock", "ticket.void", "user.login"
        },
        entity: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
            // e.g. "orders", "seats", "tickets"
        },
        entity_id: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: true,
        },
        meta_json: {
            type: sequelize_1.DataTypes.JSON,
            allowNull: true,
            // additional context: IP, user-agent, diff before/after
        },
        ip_address: {
            type: sequelize_1.DataTypes.STRING(45),
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
    await queryInterface.addIndex('audit_logs', ['tenant_id', 'action']);
    await queryInterface.addIndex('audit_logs', ['entity', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['actor_user_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
}
//# sourceMappingURL=014-create-audit-logs.js.map