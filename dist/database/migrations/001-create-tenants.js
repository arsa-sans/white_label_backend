"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    await queryInterface.createTable('tenants', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: sequelize_1.DataTypes.STRING(150),
            allowNull: false,
        },
        subdomain: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        custom_domain: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: true,
            unique: true,
        },
        logo_url: {
            type: sequelize_1.DataTypes.STRING(500),
            allowNull: true,
        },
        favicon_url: {
            type: sequelize_1.DataTypes.STRING(500),
            allowNull: true,
        },
        primary_color: {
            type: sequelize_1.DataTypes.STRING(7),
            allowNull: false,
            defaultValue: '#4F46E5',
        },
        secondary_color: {
            type: sequelize_1.DataTypes.STRING(7),
            allowNull: false,
            defaultValue: '#06B6D4',
        },
        font_family: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: true,
        },
        is_active: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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
    await queryInterface.addIndex('tenants', ['subdomain'], { unique: true });
    await queryInterface.addIndex('tenants', ['custom_domain'], {
        unique: true,
        where: { custom_domain: { [Symbol.for('ne')]: null } },
    });
}
async function down(queryInterface) {
    await queryInterface.dropTable('tenants');
}
//# sourceMappingURL=001-create-tenants.js.map