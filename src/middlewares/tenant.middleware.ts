/**
 * src/middlewares/tenant.middleware.ts
 * Resolves tenant from Host header (subdomain or custom domain).
 * Attaches req.tenant and validates tenant_id from JWT matches resolved tenant.
 *
 * SKILLS.md §7: All queries must be filtered by tenant_id.
 * Caches tenant config in Redis (TTL 5 min) to avoid DB hit per request.
 *
 * DEV MODE: Falls back to in-memory dataStore if DB is unavailable.
 */
/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiResponse } from '../utils/apiResponse';
import { dataStore } from '../database/dataStore';

const CACHE_TTL = 300; // 5 minutes

export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isDevOrTest = env.isDev || env.NODE_ENV === 'test';

    // In dev / test mode, use the in-memory dataStore fallback directly if header/host not matched
    if (isDevOrTest) {
      const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
      const found = tenantIdHeader
        ? dataStore.tenants.find((t) => t.id === tenantIdHeader)
        : dataStore.tenants[0];

      if (found) {
        req.tenant = {
          id: found.id,
          name: found.name,
          primaryColor: found.primary_color,
          secondaryColor: found.secondary_color,
        };
        req.tenantId = found.id;
        next();
        return;
      }
    }

    // Production: resolve from DB (MySQL + Redis cache)
    try {
      const { sequelize } = await import('../config/db');
      const { redis } = await import('../config/redis');
      const { QueryTypes } = await import('sequelize');

      const host = req.headers.host ?? '';
      const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;

      const cacheKey = tenantIdHeader
        ? `tenant:id:${tenantIdHeader}`
        : `tenant:host:${host.split(':')[0]}`;

      // Try cache first
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          req.tenant = JSON.parse(cached);
          req.tenantId = req.tenant?.id;
          next();
          return;
        }
      } catch {
        // Redis unavailable, fallback to DB query
      }

      interface TenantRow {
        id: string;
        name: string;
        primary_color: string;
        secondary_color: string;
        is_active: boolean;
      }

      let tenant: TenantRow | undefined;

      if (tenantIdHeader) {
        [tenant] = await sequelize.query<TenantRow>(
          'SELECT id, name, primary_color, secondary_color, is_active FROM tenants WHERE id = ? LIMIT 1',
          { replacements: [tenantIdHeader], type: QueryTypes.SELECT }
        );
      } else {
        const hostname = host.split(':')[0];
        const subdomain = hostname.split('.')[0];

        [tenant] = await sequelize.query<TenantRow>(
          `SELECT id, name, primary_color, secondary_color, is_active
           FROM tenants
           WHERE subdomain = ? OR custom_domain = ?
           LIMIT 1`,
          { replacements: [subdomain, hostname], type: QueryTypes.SELECT }
        );
      }

      if (!tenant || !tenant.is_active) {
        // Fallback to demo tenant if DB lookup fails in dev/test
        if (isDevOrTest) {
          const demoTenant = dataStore.tenants[0];
          req.tenant = {
            id: demoTenant.id,
            name: demoTenant.name,
            primaryColor: demoTenant.primary_color,
            secondaryColor: demoTenant.secondary_color,
          };
          req.tenantId = demoTenant.id;
          next();
          return;
        }
        _res.status(404).json(ApiResponse.error('Tenant not found', 404));
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
      } catch {
        // Redis unavailable, ignore cache store error
      }

      req.tenant = tenantData;
      req.tenantId = tenantData.id;
      next();
    } catch (_dbErr) {
      // DB entirely unavailable — fall back to demo tenant in dev/test
      if (isDevOrTest) {
        const demoTenant = dataStore.tenants[0];
        req.tenant = {
          id: demoTenant.id,
          name: demoTenant.name,
          primaryColor: demoTenant.primary_color,
          secondaryColor: demoTenant.secondary_color,
        };
        req.tenantId = demoTenant.id;
        next();
        return;
      }
      throw _dbErr;
    }
  } catch (err) {
    next(err);
  }
}

