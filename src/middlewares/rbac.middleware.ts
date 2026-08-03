/**
 * src/middlewares/rbac.middleware.ts
 * Role-Based Access Control middleware.
 * Must be used AFTER authenticate() middleware.
 *
 * Usage: router.post('/events', authenticate, requireRole(['organizer', 'admin']), handler)
 */
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';

export type UserRole = 'visitor' | 'organizer' | 'gate_staff' | 'vendor' | 'admin' | 'superadmin';

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(ApiResponse.error('Authentication required', 401));
      return;
    }

    const userRole = req.user.role as UserRole;

    // superadmin bypasses all role checks
    if (userRole === 'superadmin') {
      next();
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json(
        ApiResponse.error(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          403
        )
      );
      return;
    }

    next();
  };
}
