import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../../utils/apiResponse';
import { authService } from './auth.service';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json(ApiResponse.error('Email dan password wajib diisi', 400));
      return;
    }

    const result = await authService.login(email, password);
    res.json(ApiResponse.success(result, 'Login berhasil'));
  } catch (error: any) {
    const status = error.statusCode || 401;
    res.status(status).json(ApiResponse.error(error.message || 'Login gagal', status));
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role = 'visitor', event_name, event_date, event_location } = req.body;
    if (!name || !email || !password) {
      res.status(400).json(ApiResponse.error('Nama, email, dan password wajib diisi', 400));
      return;
    }

    const tenantId = (req as any).tenantId || req.tenant?.id || 'tenant-001';
    const result = await authService.register(
      name,
      email,
      password,
      role,
      tenantId,
      {
        nik: req.body.nik,
        company_name: req.body.company_name,
        event_name: req.body.event_name,
        event_date: req.body.event_date,
        event_location: req.body.event_location,
        event_description: req.body.event_description,
        portfolio_url: req.body.portfolio_url,
        npwp: req.body.npwp,
      }
    );
    res.status(201).json(ApiResponse.success(result, 'Registrasi berhasil'));
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json(ApiResponse.error(error.message || 'Registrasi gagal', status));
  }
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    let { email, name, google_id, id_token } = req.body;

    // Decode Google ID Token if provided from Google Identity Services (GSI)
    if (id_token) {
      const decoded = jwt.decode(id_token) as any;
      if (decoded && decoded.email) {
        email = email || decoded.email;
        name = name || decoded.name || decoded.email.split('@')[0];
        google_id = google_id || decoded.sub;
      }
    }

    if (!email || !name) {
      res.status(400).json(ApiResponse.error('Email dan nama dari akun Google wajib disertakan', 400));
      return;
    }

    const result = await authService.loginWithGoogle(email, name, google_id);
    res.json(ApiResponse.success(result, 'Login dengan akun Google berhasil'));
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json(ApiResponse.error(error.message || 'Google login gagal', status));
  }
}

export async function listPendingOrganizers(_req: Request, res: Response): Promise<void> {
  try {
    const list = await authService.listPendingOrganizers();
    res.json(ApiResponse.success(list, 'Daftar pengajuan akun organizer berhasil dimuat'));
  } catch (error: any) {
    res.status(500).json(ApiResponse.error('Gagal mengambil daftar pending organizer', 500));
  }
}

export async function reviewOrganizer(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(action)) {
      res.status(400).json(ApiResponse.error('Action harus approved atau rejected', 400));
      return;
    }

    const result = await authService.reviewOrganizer(userId as string, action);
    res.json(ApiResponse.success(result, `Akun organizer berhasil di-${action}`));
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json(ApiResponse.error(error.message || 'Gagal mereview akun organizer', status));
  }
}

export async function inviteStaff(req: Request, res: Response): Promise<void> {
  try {
    const organizerId = req.user?.userId;
    const tenantId = req.user?.tenantId || 'tenant-001';
    const { email, name, event_id } = req.body;

    if (!email || !name) {
      res.status(400).json(ApiResponse.error('Email dan nama staff wajib diisi', 400));
      return;
    }

    const result = await authService.createStaffInvitation(
      organizerId!,
      email,
      name,
      tenantId,
      event_id
    );
    res.status(201).json(ApiResponse.success(result, 'Undangan gate staff berhasil dibuat'));
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json(ApiResponse.error(error.message || 'Gagal mengundang staff', status));
  }
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json(ApiResponse.error('Token undangan dan password wajib diisi', 400));
      return;
    }

    const result = await authService.acceptInvitation(token, password);
    res.json(ApiResponse.success(result, 'Akun gate staff berhasil diaktifkan'));
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json(ApiResponse.error(error.message || 'Gagal menerima undangan', status));
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
    res.status(status).json(ApiResponse.error(error.message || 'User tidak ditemukan', status));
  }
}

