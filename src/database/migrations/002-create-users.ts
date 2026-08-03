import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('users', {
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
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true, // null for OAuth-only users
    },
    role: {
      type: DataTypes.ENUM('visitor', 'organizer', 'gate_staff', 'vendor', 'admin', 'superadmin'),
      allowNull: false,
      defaultValue: 'visitor',
    },
    mfa_secret: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    mfa_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    verification_token: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    refresh_token_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_login_at: {
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

  // UNIQUE composite: one email per tenant
  await queryInterface.addIndex('users', ['tenant_id', 'email'], {
    unique: true,
    name: 'users_tenant_email_unique',
  });
  await queryInterface.addIndex('users', ['tenant_id', 'role']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('users');
}
