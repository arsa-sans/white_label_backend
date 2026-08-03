import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('booth_transactions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    vendor_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'vendors', key: 'id' },
      onDelete: 'RESTRICT',
    },
    wallet_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'wallets', key: 'id' },
      onDelete: 'RESTRICT',
    },
    nominal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('payment', 'refund', 'topup'),
      allowNull: false,
    },
    // SKILLS.md §6: DB-level UNIQUE for idempotency (device retries must not double-debit)
    // Device generates UUID per tap/transaction attempt
    idempotency_key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    // Running balance snapshot for audit (SUM should always reconcile to wallets.balance)
    balance_before: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
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

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('booth_transactions');
}
