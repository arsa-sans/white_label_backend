/**
 * src/middlewares/rbac.middleware.ts
 * Role-Based Access Control middleware.
 * Must be used AFTER authenticate() middleware.
 *
 * Usage: router.post('/events', authenticate, requireRole(['organizer', 'admin']), handler)
 */
import { Request, Response, NextFunction } from 'express';
export type UserRole = 'visitor' | 'organizer' | 'gate_staff' | 'vendor' | 'admin' | 'superadmin';
export declare function requireRole(allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rbac.middleware.d.ts.map