/**
 * src/middlewares/auth.middleware.ts
 * Verifies JWT access token from Authorization: Bearer header.
 * Attaches decoded payload to req.user.
 */
import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.middleware.d.ts.map