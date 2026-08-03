import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('gate_scan_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    ticket_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tickets', key: 'id' },
      onDelete: 'RESTRICT',
    },
    gate_device_id: {
      type: DataTypes.UUID,
      allowNull: true, // may be null for manually entered scans
      references: { model: 'gate_devices', key: 'id' },
      onDelete: 'SET NULL',
    },
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // SKILLS.md §4: offline logs are 'pending', pushed to server in background
    sync_status: {
      type: DataTypes.ENUM('synced', 'pending'),
      allowNull: false,
      defaultValue: 'synced',
    },
    result: {
      type: DataTypes.ENUM('valid', 'invalid', 'duplicate', 'expired', 'duplicate_conflict'),
      allowNull: false,
    },
    // Raw QR token scanned (for forensics, stored encrypted in prod)
    qr_token_preview: {
      type: DataTypes.STRING(32),
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

  // REQUIRED index (spec)
  await queryInterface.addIndex('gate_scan_logs', ['ticket_id'], {
    name: 'gate_scan_logs_ticket_id_idx',
  });
  await queryInterface.addIndex('gate_scan_logs', ['gate_device_id', 'sync_status']);
  await queryInterface.addIndex('gate_scan_logs', ['scanned_at']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('gate_scan_logs');
}
