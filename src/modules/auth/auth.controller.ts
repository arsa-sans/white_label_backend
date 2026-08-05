import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { authService } from './auth.service';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json(ApiResponse.error('Email and password are required', 400));
      return;
    }

    const result = await authService.login(email, password);
    res.json(ApiResponse.success(result, 'Login successful'));
  } catch (error: any) {
    const status = error.statusCode || 401;
    res.status(status).json(ApiResponse.error(error.message || 'Login failed', status));
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      res.status(400).json(ApiResponse.error('Name, email, and password are required', 400));
      return;
    }

    const result = await authService.register(
      name,
      email,
      password,
      role,
      req.tenant?.id
    );
    res.status(201).json(ApiResponse.success(result, 'Registration successful'));
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json(ApiResponse.error(error.message || 'Registration failed', status));
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json(ApiResponse.error('Unauthorized', 401));
      return;
    }

    const user = await authService.getMe(userId);
    res.json(ApiResponse.success(user));
  } catch (error: any) {
    const status = error.statusCode || 404;
    res.status(status).json(ApiResponse.error(error.message || 'User not found', status));
  }
}
