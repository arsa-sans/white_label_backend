import { JwtPayload } from '../middlewares/auth.middleware';

export interface TenantContext {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenant?: TenantContext;
      tenantId?: string;
    }
  }
}

