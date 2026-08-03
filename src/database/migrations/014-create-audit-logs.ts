import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('audit_logs', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: true, // null for platform-level actions (superadmin)
      references: { model: 'tenants', key: 'id' },
      onDelete: 'SET NULL',
    },
    actor_user_id: {
      type: DataTypes.UUID,
      allowNull: true, // null for system/automated actions
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      // e.g. "order.create", "seat.lock", "ticket.void", "user.login"
    },
    entity: {
      type: DataTypes.STRING(100),
      allowNull: false,
      // e.g. "orders", "seats", "tickets"
    },
    entity_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    meta_json: {
      type: DataTypes.JSON,
      allowNull: true,
      // additional context: IP, user-agent, diff before/after
    },
    ip_address: {
      type: DataTypes.STRING(45),
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

  await queryInterface.addIndex('audit_logs', ['tenant_id', 'action']);
  await queryInterface.addIndex('audit_logs', ['entity', 'entity_id']);
  await queryInterface.addIndex('audit_logs', ['actor_user_id']);
  await queryInterface.addIndex('audit_logs', ['created_at']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('audit_logs');
}
