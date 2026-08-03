"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('events', {
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
        organizer_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'RESTRICT',
        },
        name: {
            type: sequelize_1.DataTypes.STRING(300),
            allowNull: false,
        },
        slug: {
            type: sequelize_1.DataTypes.STRING(350),
            allowNull: false,
            unique: true,
        },
        description: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
        },
        location: {
            type: sequelize_1.DataTypes.STRING(500),
            allowNull: true,
        },
        venue_map_url: {
            type: sequelize_1.DataTypes.STRING(500),
            allowNull: true,
        },
        banner_url: {
            type: sequelize_1.DataTypes.STRING(500),
            allowNull: true,
        },
        start_date: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
        },
        end_date: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
        },
        capacity: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
        },
        status: {
            type: sequelize_1.DataTypes.ENUM('draft', 'published', 'on_sale', 'sold_out', 'cancelled', 'completed'),
            allowNull: false,
            defaultValue: 'draft',
        },
        is_flash_sale: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        category: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: true,
        },
        tags: {
            type: sequelize_1.DataTypes.JSON,
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
    await queryInterface.addIndex('events', ['tenant_id', 'status']);
    await queryInterface.addIndex('events', ['tenant_id', 'start_date']);
    await queryInterface.addIndex('events', ['slug'], { unique: true });
}
async function down(queryInterface) {
    await queryInterface.dropTable('events');
}
//# sourceMappingURL=003-create-events.js.map