import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('orders', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'RESTRICT',
    },
    event_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'RESTRICT',
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'expired', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    // SKILLS.md §2: UNIQUE constraint at DB level — not just application level
    idempotency_key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    payment_gateway: {
      type: DataTypes.STRING(50),
      allowNull: true, // e.g. "midtrans", "xendit"
    },
    gateway_ref: {
      type: DataTypes.STRING(255),
      allowNull: true, // transaction ID from gateway (2nd idempotency key)
    },
    gateway_payload: {
      type: DataTypes.JSON,
      allowNull: true, // full webhook payload for audit
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paid_at: {
      type: DataTypes.DATE,
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

  // REQUIRED index (SKILLS.md §2): idempotency_key lookup must be instant
  await queryInterface.addIndex('orders', ['idempotency_key'], {
    unique: true,
    name: 'orders_idempotency_key_idx',
  });
  await queryInterface.addIndex('orders', ['gateway_ref'], {
    name: 'orders_gateway_ref_idx',
  });
  await queryInterface.addIndex('orders', ['tenant_id', 'status']);
  await queryInterface.addIndex('orders', ['user_id', 'status']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('orders');
}
