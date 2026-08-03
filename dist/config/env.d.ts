/**
 * src/config/env.ts
 * Validated environment variables. Fails fast at startup if required vars are missing.
 * All other modules import from here — never from process.env directly.
 */
import 'dotenv/config';
export declare const env: {
    PORT: number;
    NODE_ENV: string;
    isDev: boolean;
    isProd: boolean;
    DB_HOST: string;
    DB_PORT: number;
    DB_NAME: string;
    DB_USER: string;
    DB_PASS: string;
    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_PASSWORD: string;
    RABBITMQ_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: string;
    QR_AES_KEY: string;
    GATE_HMAC_SECRET: string;
    S3_ENDPOINT: string;
    S3_ACCESS_KEY: string;
    S3_SECRET_KEY: string;
    S3_BUCKET: string;
    S3_REGION: string;
    MIDTRANS_SERVER_KEY: string;
    MIDTRANS_CLIENT_KEY: string;
    MIDTRANS_IS_PRODUCTION: boolean;
    SENDGRID_API_KEY: string;
    CORS_ORIGIN: string;
};
//# sourceMappingURL=env.d.ts.map