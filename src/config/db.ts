/**
 * src/config/db.ts
 * Sequelize instance — shared across all modules.
 * Models are registered in each module's model file.
 */
import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  logging: env.isDev ? (sql: string) => console.log(`[SQL] ${sql}`) : false,
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,   // snake_case columns by default
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

export async function connectDB(): Promise<void> {
  await sequelize.authenticate();
  console.log('[DB] MySQL connected');
}
