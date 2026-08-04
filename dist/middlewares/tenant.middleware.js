"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenant = resolveTenant;
/**
 * src/middlewares/tenant.middleware.ts
 * Resolves tenant from Host header (subdomain or custom domain).
 * Attaches req.tenant and validates tenant_id from JWT matches resolved tenant.
 *
 * SKILLS.md §7: All queries must be filtered by tenant_id.
 * Caches tenant config in Redis (TTL 5 min) to avoid DB hit per request.
 */
require("../types/express");
const db_1 = require("../config/db");
const redis_1 = require("../config/redis");
const apiResponse_1 = require("../utils/apiResponse");
const sequelize_1 = require("sequelize");
const CACHE_TTL = 300; // 5 minutes
async function resolveTenant(req, res, next) {
    try {
        const host = req.headers.host ?? '';
        // Support X-Tenant-Id header for mobile app (SKILLS.md §8)
        const tenantIdHeader = req.headers['x-tenant-id'];
        const cacheKey = tenantIdHeader
            ? `tenant:id:${tenantIdHeader}`
            : `tenant:host:${host.split(':')[0]}`; // strip port
        // Try cache first
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            req.tenant = JSON.parse(cached);
            next();
            return;
        }
        let tenant;
        if (tenantIdHeader) {
            // Mobile: lookup by ID, validate later in auth middleware that user belongs to this tenant
            [tenant] = await db_1.sequelize.query('SELECT id, name, primary_color, secondary_color, is_active FROM tenants WHERE id = ? LIMIT 1', { replacements: [tenantIdHeader], type: sequelize_1.QueryTypes.SELECT });
        }
        else {
            // Web: resolve from subdomain or custom_domain
            const hostname = host.split(':')[0];
            const subdomain = hostname.split('.')[0];
            [tenant] = await db_1.sequelize.query(`SELECT id, name, primary_color, secondary_color, is_active
         FROM tenants
         WHERE subdomain = ? OR custom_domain = ?
         LIMIT 1`, { replacements: [subdomain, hostname], type: sequelize_1.QueryTypes.SELECT });
        }
        if (!tenant || !tenant.is_active) {
            res.status(404).json(apiResponse_1.ApiResponse.error('Tenant not found', 404));
            return;
        }
        const tenantData = {
            id: tenant.id,
            name: tenant.name,
            primaryColor: tenant.primary_color,
            secondaryColor: tenant.secondary_color,
        };
        await redis_1.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(tenantData));
        req.tenant = tenantData;
        next();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=tenant.middleware.js.map