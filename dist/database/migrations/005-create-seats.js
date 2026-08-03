"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('seats', {
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
        venue_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            references: { model: 'venues', key: 'id' },
            onDelete: 'SET NULL',
        },
        // e.g. "A", "B", "VIP-1"
        row: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: false,
        },
        // e.g. 1, 2, 3
        number: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        // e.g. "Regular", "VIP", "VVIP", "Fest Area"
        category: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
        },
        price: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        // CRITICAL: status transitions managed by Ticket Service (Skill 1)
        // available → locked (Redis lock + DB lock) → sold | available (TTL expired)
        status: {
            type: sequelize_1.DataTypes.ENUM('available', 'locked', 'sold'),
            allowNull: false,
            defaultValue: 'available',
        },
        locked_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
        locked_by_user_id: {
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
    // REQUIRED index (SKILLS.md §1): frequent queries for available seats per event
    await queryInterface.addIndex('seats', ['event_id', 'status'], {
        name: 'seats_event_status_idx',
    });
    await queryInterface.addIndex('seats', ['event_id', 'category']);
    // Composite unique: no duplicate seat row+number in same event
    await queryInterface.addIndex('seats', ['event_id', 'row', 'number'], {
        unique: true,
        name: 'seats_event_row_number_unique',
    });
}
async function down(queryInterface) {
    await queryInterface.dropTable('seats');
}
//# sourceMappingURL=005-create-seats.js.map