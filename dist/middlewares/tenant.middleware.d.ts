/**
 * src/middlewares/tenant.middleware.ts
 * Resolves tenant from Host header (subdomain or custom domain).
 * Attaches req.tenant and validates tenant_id from JWT matches resolved tenant.
 *
 * SKILLS.md §7: All queries must be filtered by tenant_id.
 * Caches tenant config in Redis (TTL 5 min) to avoid DB hit per request.
 */
import { Request, Response, NextFunction } from 'express';
export declare function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=tenant.middleware.d.ts.map