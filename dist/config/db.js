"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
exports.connectDB = connectDB;
/**
 * src/config/db.ts
 * Sequelize instance — shared across all modules.
 * Models are registered in each module's model file.
 */
const sequelize_1 = require("sequelize");
const env_1 = require("./env");
exports.sequelize = new sequelize_1.Sequelize(env_1.env.DB_NAME, env_1.env.DB_USER, env_1.env.DB_PASS, {
    host: env_1.env.DB_HOST,
    port: env_1.env.DB_PORT,
    dialect: 'mysql',
    logging: env_1.env.isDev ? (sql) => console.log(`[SQL] ${sql}`) : false,
    pool: {
        max: 20,
        min: 2,
        acquire: 30000,
        idle: 10000,
    },
    define: {
        underscored: true, // snake_case columns by default
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});
async function connectDB() {
    await exports.sequelize.authenticate();
    console.log('[DB] MySQL connected');
}
//# sourceMappingURL=db.js.map