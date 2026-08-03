import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('tickets', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    event_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'RESTRICT',
    },
    seat_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'seats', key: 'id' },
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'RESTRICT',
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'orders', key: 'id' },
      onDelete: 'RESTRICT',
    },
    // SKILLS.md §3: random 32-byte seed, stored at ticket issuance (order.paid)
    // Used to derive time-windowed AES-encrypted QR tokens — never sent raw to client
    qr_seed: {
      type: DataTypes.STRING(64), // 32 bytes hex-encoded
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('valid', 'used', 'void', 'refunded'),
      allowNull: false,
      defaultValue: 'valid',
    },
    issued_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    used_gate_device_id: {
      type: DataTypes.UUID,
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

  // REQUIRED index (spec): gate validation looks up qr_seed during scan
  await queryInterface.addIndex('tickets', ['qr_seed'], {
    unique: true,
    name: 'tickets_qr_seed_idx',
  });
  await queryInterface.addIndex('tickets', ['event_id', 'status']);
  await queryInterface.addIndex('tickets', ['user_id']);
  await queryInterface.addIndex('tickets', ['order_id']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('tickets');
}
