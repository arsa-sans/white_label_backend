"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('order_items', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        order_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'orders', key: 'id' },
            onDelete: 'CASCADE',
        },
        seat_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'seats', key: 'id' },
            onDelete: 'RESTRICT',
        },
        price: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
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
    await queryInterface.addIndex('order_items', ['order_id']);
    await queryInterface.addIndex('order_items', ['seat_id']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('order_items');
}
//# sourceMappingURL=007-create-order-items.js.map