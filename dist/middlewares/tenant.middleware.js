"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenant = resolveTenant;
const env_1 = require("../config/env");
const apiResponse_1 = require("../utils/apiResponse");
const dataStore_1 = require("../database/dataStore");
const CACHE_TTL = 300; // 5 minutes
async function resolveTenant(req, _res, next) {
    try {
        // In dev mode, use the in-memory dataStore fallback directly
        // (avoids needing MySQL + Redis running for local UI testing)
        if (env_1.env.isDev) {
            const demoTenant = dataStore_1.dataStore.tenants[0];
            if (demoTenant) {
                req.tenant = {
                    id: demoTenant.id,
                    name: demoTenant.name,
                    primaryColor: demoTenant.primary_color,
                    secondaryColor: demoTenant.secondary_color,
                };
                next();
                return;
            }
        }
        // Production: resolve from DB (MySQL + Redis cache)
        try {
            const { sequelize } = await Promise.resolve().then(() => __importStar(require('../config/db')));
            const { redis } = await Promise.resolve().then(() => __importStar(require('../config/redis')));
            const { QueryTypes } = await Promise.resolve().then(() => __importStar(require('sequelize')));
            const host = req.headers.host ?? '';
            const tenantIdHeader = req.headers['x-tenant-id'];
            const cacheKey = tenantIdHeader
                ? `tenant:id:${tenantIdHeader}`
                : `tenant:host:${host.split(':')[0]}`;
            // Try cache first
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    req.tenant = JSON.parse(cached);
                    next();
                    return;
                }
            }
            catch {
                // Redis unavailable, fallback to DB query
            }
            let tenant;
            if (tenantIdHeader) {
                [tenant] = await sequelize.query('SELECT id, name, primary_color, secondary_color, is_active FROM tenants WHERE id = ? LIMIT 1', { replacements: [tenantIdHeader], type: QueryTypes.SELECT });
            }
            else {
                const hostname = host.split(':')[0];
                const subdomain = hostname.split('.')[0];
                [tenant] = await sequelize.query(`SELECT id, name, primary_color, secondary_color, is_active
           FROM tenants
           WHERE subdomain = ? OR custom_domain = ?
           LIMIT 1`, { replacements: [subdomain, hostname], type: QueryTypes.SELECT });
            }
            if (!tenant || !tenant.is_active) {
                // Fallback to demo tenant if DB lookup fails in dev
                if (env_1.env.isDev) {
                    const demoTenant = dataStore_1.dataStore.tenants[0];
                    req.tenant = {
                        id: demoTenant.id,
                        name: demoTenant.name,
                        primaryColor: demoTenant.primary_color,
                        secondaryColor: demoTenant.secondary_color,
                    };
                    next();
                    return;
                }
                _res.status(404).json(apiResponse_1.ApiResponse.error('Tenant not found', 404));
                return;
            }
            const tenantData = {
                id: tenant.id,
                name: tenant.name,
                primaryColor: tenant.primary_color,
                secondaryColor: tenant.secondary_color,
            };
            try {
                await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(tenantData));
            }
            catch {
                // Redis unavailable, ignore cache store error
            }
            req.tenant = tenantData;
            next();
        }
        catch (_dbErr) {
            // DB entirely unavailable — fall back to demo tenant in dev
            if (env_1.env.isDev) {
                const demoTenant = dataStore_1.dataStore.tenants[0];
                req.tenant = {
                    id: demoTenant.id,
                    name: demoTenant.name,
                    primaryColor: demoTenant.primary_color,
                    secondaryColor: demoTenant.secondary_color,
                };
                next();
                return;
            }
            throw _dbErr;
        }
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=tenant.middleware.js.map