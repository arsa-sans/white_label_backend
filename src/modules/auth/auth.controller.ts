import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json(ApiResponse.error('Email and password are required', 400));
    return;
  }

  const user = dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password_hash !== password) {
    res.status(401).json(ApiResponse.error('Invalid email or password', 401));
    return;
  }

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json(
    ApiResponse.success(
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
        },
      },
      'Login successful'
    )
  );
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json(ApiResponse.error('Name, email, and password are required', 400));
    return;
  }

  const existing = dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(409).json(ApiResponse.error('User with this email already exists', 409));
    return;
  }

  const newUser = {
    id: `user-${Date.now()}`,
    tenant_id: req.tenant?.id || 'tenant-001',
    name,
    email,
    password_hash: password,
    role: (role || 'visitor') as any,
  };

  dataStore.users.push(newUser);

  const token = jwt.sign(
    {
      userId: newUser.id,
      tenantId: newUser.tenant_id,
      role: newUser.role,
      email: newUser.email,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json(
    ApiResponse.success(
      {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          tenant_id: newUser.tenant_id,
        },
      },
      'Registration successful'
    )
  );
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const user = dataStore.users.find((u) => u.id === userId);

  if (!user) {
    res.status(444).json(ApiResponse.error('User not found', 404));
    return;
  }

  res.json(
    ApiResponse.success({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    })
  );
}
