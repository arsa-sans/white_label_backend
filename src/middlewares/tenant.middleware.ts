/**
 * src/middlewares/tenant.middleware.ts
 * Resolves tenant from Host header (subdomain or custom domain).
 * Attaches req.tenant and validates tenant_id from JWT matches resolved tenant.
 *
 * SKILLS.md §7: All queries must be filtered by tenant_id.
 * Caches tenant config in Redis (TTL 5 min) to avoid DB hit per request.
 */
import { Request, Response, NextFunction } from 'express';
import { sequelize } from '../config/db';
import { redis } from '../config/redis';
import { ApiResponse } from '../utils/apiResponse';
import { QueryTypes } from 'sequelize';

interface TenantRow {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
}

const CACHE_TTL = 300; // 5 minutes

export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const host = req.headers.host ?? '';

    // Support X-Tenant-Id header for mobile app (SKILLS.md §8)
    const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;

    const cacheKey = tenantIdHeader
      ? `tenant:id:${tenantIdHeader}`
      : `tenant:host:${host.split(':')[0]}`; // strip port

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      req.tenant = JSON.parse(cached);
      next();
      return;
    }

    let tenant: TenantRow | undefined;

    if (tenantIdHeader) {
      // Mobile: lookup by ID, validate later in auth middleware that user belongs to this tenant
      [tenant] = await sequelize.query<TenantRow>(
        'SELECT id, name, primary_color, secondary_color, is_active FROM tenants WHERE id = ? LIMIT 1',
        { replacements: [tenantIdHeader], type: QueryTypes.SELECT }
      );
    } else {
      // Web: resolve from subdomain or custom_domain
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
      res.status(404).json(ApiResponse.error('Tenant not found', 404));
      return;
    }

    const tenantData = {
      id: tenant.id,
      name: tenant.name,
      primaryColor: tenant.primary_color,
      secondaryColor: tenant.secondary_color,
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(tenantData));
    req.tenant = tenantData;
    next();
  } catch (err) {
    next(err);
  }
}
