/**
 * src/middlewares/auth.middleware.ts
 * Verifies JWT access token from Authorization: Bearer header.
 * Attaches decoded payload to req.user.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiResponse } from '../utils/apiResponse';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(ApiResponse.error('Authentication required', 401));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json(ApiResponse.error('Token expired', 401));
      return;
    }
    res.status(401).json(ApiResponse.error('Invalid token', 401));
  }
}
