/**
 * src/config/env.ts
 * Validated environment variables. Fails fast at startup if required vars are missing.
 * All other modules import from here — never from process.env directly.
 */
import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`[ENV] Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalNumber(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const env = {
  // Server
  PORT: optionalNumber('PORT', 4000),
  NODE_ENV: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',

  // Database
  DB_HOST: optional('DB_HOST', 'localhost'),
  DB_PORT: optionalNumber('DB_PORT', 3306),
  DB_NAME: optional('DB_NAME', 'db_whitelabel'),
  DB_USER: optional('DB_USER', 'root'),
  DB_PASS: optional('DB_PASS', ''),

  // Redis
  REDIS_HOST: optional('REDIS_HOST', 'localhost'),
  REDIS_PORT: optionalNumber('REDIS_PORT', 6379),
  REDIS_PASSWORD: optional('REDIS_PASSWORD', ''),

  // RabbitMQ
  RABBITMQ_URL: optional('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),

  // JWT
  JWT_SECRET: optional('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '15m'),
  JWT_REFRESH_SECRET: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  // Dynamic QR (AES-256) — platform-level secret, never expose to client
  QR_AES_KEY: optional('QR_AES_KEY', 'dev-qr-aes-key-32-chars-minimum-ok'),

  // Offline Gate HMAC
  GATE_HMAC_SECRET: optional('GATE_HMAC_SECRET', 'dev-gate-hmac-secret-ok'),


  // S3 / MinIO
  S3_ENDPOINT: optional('S3_ENDPOINT', 'http://localhost:9000'),
  S3_ACCESS_KEY: optional('S3_ACCESS_KEY', 'minioadmin'),
  S3_SECRET_KEY: optional('S3_SECRET_KEY', 'minioadmin'),
  S3_BUCKET: optional('S3_BUCKET', 'whitelabel'),
  S3_REGION: optional('S3_REGION', 'us-east-1'),

  // Payment (Midtrans)
  MIDTRANS_SERVER_KEY: optional('MIDTRANS_SERVER_KEY', ''),
  MIDTRANS_CLIENT_KEY: optional('MIDTRANS_CLIENT_KEY', ''),
  MIDTRANS_IS_PRODUCTION: optional('MIDTRANS_IS_PRODUCTION', 'false') === 'true',

  // Google OAuth
  GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET', ''),

  // Notification & Admin Email for Organizer Approval
  ADMIN_EMAIL: optional('ADMIN_EMAIL', 'arsaprayata72@gmail.com'),
  SENDGRID_API_KEY: optional('SENDGRID_API_KEY', ''),

  // SMTP (Gmail / Custom Mailer)
  SMTP_HOST: optional('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: Number(optional('SMTP_PORT', '587')),
  SMTP_SECURE: optional('SMTP_SECURE', 'false') === 'true',
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),
  EMAIL_FROM: optional('EMAIL_FROM', 'WhiteLabel Support <noreply@whitelabel.id>'),

  // CORS
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:3000'),
};
