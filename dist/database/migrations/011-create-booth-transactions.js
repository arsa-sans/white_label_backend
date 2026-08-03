"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('booth_transactions', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        vendor_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'vendors', key: 'id' },
            onDelete: 'RESTRICT',
        },
        wallet_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: { model: 'wallets', key: 'id' },
            onDelete: 'RESTRICT',
        },
        nominal: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        type: {
            type: sequelize_1.DataTypes.ENUM('payment', 'refund', 'topup'),
            allowNull: false,
        },
        // SKILLS.md §6: DB-level UNIQUE for idempotency (device retries must not double-debit)
        // Device generates UUID per tap/transaction attempt
        idempotency_key: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        // Running balance snapshot for audit (SUM should always reconcile to wallets.balance)
        balance_before: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        balance_after: {
            type: sequelize_1.DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        description: {
            type: sequelize_1.DataTypes.STRING(300),
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
    await queryInterface.addIndex('booth_transactions', ['wallet_id']);
    await queryInterface.addIndex('booth_transactions', ['vendor_id']);
    await queryInterface.addIndex('booth_transactions', ['idempotency_key'], {
        unique: true,
        name: 'booth_tx_idempotency_idx',
    });
}
async function down(queryInterface) {
    await queryInterface.dropTable('booth_transactions');
}
//# sourceMappingURL=011-create-booth-transactions.js.map