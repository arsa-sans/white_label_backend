"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('wallets', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
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
        // SKILLS.md §6: balance must be updated only inside DB transaction with FOR UPDATE row lock
        balance: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0,
        },
        // NFC wristband pairing — nullable until user pairs wristband at venue
        nfc_uid: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: true,
            unique: true,
        },
        is_refunded: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        refunded_at: {
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
    // One wallet per user per event
    await queryInterface.addIndex('wallets', ['user_id', 'event_id'], {
        unique: true,
        name: 'wallets_user_event_unique',
    });
    await queryInterface.addIndex('wallets', ['nfc_uid'], {
        unique: true,
        name: 'wallets_nfc_uid_idx',
    });
}
async function down(queryInterface) {
    await queryInterface.dropTable('wallets');
}
//# sourceMappingURL=009-create-wallets.js.map