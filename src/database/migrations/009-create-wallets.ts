import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('wallets', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
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
    // SKILLS.md §6: balance must be updated only inside DB transaction with FOR UPDATE row lock
    balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // NFC wristband pairing — nullable until user pairs wristband at venue
    nfc_uid: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    is_refunded: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    refunded_at: {
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

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('wallets');
}
