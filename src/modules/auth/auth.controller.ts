import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { ApiResponse } from '../../utils/apiResponse';
import { authService } from './auth.service';
import { env } from '../../config/env';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

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
    const { name, email, password, role = 'visitor' } = req.body;
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
    const { id_token, access_token, email: bodyEmail, name: bodyName, google_id: bodyGoogleId } = req.body;

    let email: string;
    let name: string;
    let google_id: string | undefined;

    if (id_token) {
      // ── Path A: Real id_token (authorization_code flow) ───────────────────────
      // Verify the id_token using google-auth-library
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          res.status(401).json(ApiResponse.error('Token Google tidak valid atau kadaluarsa', 401));
          return;
        }
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        google_id = payload.sub;
      } catch {
        res.status(401).json(ApiResponse.error('Verifikasi id_token Google gagal', 401));
        return;
      }
    } else if (access_token) {
      // ── Path B: access_token from implicit flow (@react-oauth/google) ─────────
      // Fetch user info from Google's userinfo endpoint
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (!userInfoRes.ok) {
          res.status(401).json(ApiResponse.error('access_token Google tidak valid atau kadaluarsa', 401));
          return;
        }
        const userInfo = await userInfoRes.json() as { email?: string; name?: string; sub?: string };
        if (!userInfo.email) {
          res.status(401).json(ApiResponse.error('Tidak dapat mengambil data user dari Google', 401));
          return;
        }
        email = userInfo.email;
        name = userInfo.name || userInfo.email.split('@')[0];
        google_id = userInfo.sub;
      } catch {
        res.status(401).json(ApiResponse.error('Gagal menghubungi Google untuk verifikasi token', 401));
        return;
      }
    } else if (bodyEmail && bodyName) {
      // ── Path C: Direct email/name (dev/simulation mode only) ─────────────────
      // Only allowed in development mode
      if (env.NODE_ENV !== 'development') {
        res.status(400).json(ApiResponse.error('id_token atau access_token Google wajib disertakan', 400));
        return;
      }
      email = bodyEmail;
      name = bodyName;
      google_id = bodyGoogleId;
    } else {
      res.status(400).json(ApiResponse.error('id_token atau access_token Google wajib disertakan', 400));
      return;
    }

    const result = await authService.loginWithGoogle(email, name, google_id);
    res.json(ApiResponse.success(result, 'Login dengan akun Google berhasil'));
  } catch (error: any) {
    const status = error.statusCode || 401;
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

