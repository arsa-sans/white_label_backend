"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('vendors', {
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
        owner_user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'RESTRICT',
        },
        booth_name: {
            type: sequelize_1.DataTypes.STRING(200),
            allowNull: false,
        },
        booth_type: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: true, // e.g. "F&B", "Merchandise", "Service"
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
    await queryInterface.addIndex('vendors', ['event_id', 'owner_user_id']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('vendors');
}
//# sourceMappingURL=010-create-vendors.js.map