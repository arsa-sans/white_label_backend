"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
/**
 * src/config/env.ts
 * Validated environment variables. Fails fast at startup if required vars are missing.
 * All other modules import from here — never from process.env directly.
 */
require("dotenv/config");
function required(key) {
    const val = process.env[key];
    if (!val) {
        throw new Error(`[ENV] Missing required environment variable: ${key}`);
    }
    return val;
}
function optional(key, fallback) {
    return process.env[key] ?? fallback;
}
function optionalNumber(key, fallback) {
    const val = process.env[key];
    return val ? parseInt(val, 10) : fallback;
}
exports.env = {
    // Server
    PORT: optionalNumber('PORT', 4000),
    NODE_ENV: optional('NODE_ENV', 'development'),
    isDev: optional('NODE_ENV', 'development') === 'development',
    isProd: optional('NODE_ENV', 'development') === 'production',
    // Database
    DB_HOST: optional('DB_HOST', '127.0.0.1'),
    DB_PORT: optionalNumber('DB_PORT', 3306),
    DB_NAME: optional('DB_NAME', 'whitelabel_dev'),
    DB_USER: optional('DB_USER', 'root'),
    DB_PASS: optional('DB_PASS', ''),
    // Redis
    REDIS_HOST: optional('REDIS_HOST', 'localhost'),
    REDIS_PORT: optionalNumber('REDIS_PORT', 6379),
    REDIS_PASSWORD: optional('REDIS_PASSWORD', ''),
    // RabbitMQ
    RABBITMQ_URL: optional('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    // JWT
    JWT_SECRET: required('JWT_SECRET'),
    JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '15m'),
    JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
    JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
    // Dynamic QR (AES-256) — platform-level secret, never expose to client
    QR_AES_KEY: required('QR_AES_KEY'),
    // Offline Gate HMAC
    GATE_HMAC_SECRET: required('GATE_HMAC_SECRET'),
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
    // Notification
    SENDGRID_API_KEY: optional('SENDGRID_API_KEY', ''),
    // CORS
    CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:3000'),
};
//# sourceMappingURL=env.js.map