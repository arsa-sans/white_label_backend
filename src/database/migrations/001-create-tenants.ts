import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('tenants', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    subdomain: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    custom_domain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    logo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    favicon_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    primary_color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#4F46E5',
    },
    secondary_color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#06B6D4',
    },
    font_family: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  await queryInterface.addIndex('tenants', ['subdomain'], { unique: true });
  await queryInterface.addIndex('tenants', ['custom_domain'], {
    unique: true,
    where: { custom_domain: { [Symbol.for('ne')]: null } } as Record<string, unknown>,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('tenants');
}
