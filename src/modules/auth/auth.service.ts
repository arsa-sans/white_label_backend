import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { DemoUser } from '../../database/dataStore';
import { authRepository, AuthRepository } from './auth.repository';

export interface AuthResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenant_id: string;
  };
}

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.repo.findByEmail(email);
    if (!user || user.password_hash !== password) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user);
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async register(
    name: string,
    email: string,
    password: string,
    role?: string,
    tenantId?: string
  ): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      const err = new Error('User with this email already exists');
      (err as any).statusCode = 409;
      throw err;
    }

    const newUser: DemoUser = {
      id: `user-${Date.now()}`,
      tenant_id: tenantId || 'tenant-001',
      name,
      email,
      password_hash: password,
      role: (role || 'visitor') as any,
    };

    await this.repo.create(newUser);
    const token = this.generateToken(newUser);

    return {
      token,
      user: this.sanitizeUser(newUser),
    };
  }

  async getMe(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      (err as any).statusCode = 404;
      throw err;
    }
    return this.sanitizeUser(user);
  }

  private generateToken(user: DemoUser): string {
    return jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  private sanitizeUser(user: DemoUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    };
  }
}

export const authService = new AuthService();
