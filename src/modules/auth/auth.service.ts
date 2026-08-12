import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import { DemoUser, UserRole, dataStore } from '../../database/dataStore';

export interface AuthResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenant_id: string;
    approval_status: string;
  };
}

// ─── Allowed public register roles ───────────────────────────────────────────
const PUBLIC_REGISTER_ROLES: UserRole[] = ['visitor', 'organizer'];

export class AuthService {

  // ─── Login ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<AuthResult> {
    const user = this.findByEmail(email);

    if (!user || user.password_hash !== password) {
      const err = new Error('Email atau password salah');
      (err as any).statusCode = 401;
      throw err;
    }

    // Organizer yang masih pending tidak bisa login
    if (user.role === 'organizer' && user.approval_status === 'pending') {
      const err = new Error('Akun organizer Anda sedang menunggu verifikasi admin. Mohon bersabar.');
      (err as any).statusCode = 403;
      throw err;
    }

    // Organizer yang ditolak tidak bisa login
    if (user.role === 'organizer' && user.approval_status === 'rejected') {
      const err = new Error('Pendaftaran akun organizer Anda telah ditolak. Hubungi admin untuk informasi lebih lanjut.');
      (err as any).statusCode = 403;
      throw err;
    }

    const token = this.generateToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  // ─── Register Visitor ────────────────────────────────────────────────────────
  async registerVisitor(
    name: string,
    email: string,
    password: string,
    tenantId: string
  ): Promise<AuthResult> {
    this.assertEmailNotTaken(email);

    const newUser: DemoUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: tenantId,
      name,
      email,
      password_hash: password,
      role: 'visitor',
      approval_status: 'approved',
    };

    dataStore.users.push(newUser);
    const token = this.generateToken(newUser);
    return { token, user: this.sanitizeUser(newUser) };
  }

  // ─── Register Organizer ──────────────────────────────────────────────────────
  /**
   * Organizer register: Wajib verifikasi NIK/KTP, Nama Perusahaan, Nama & Deskripsi Event.
   * approval_status di-set 'pending' (membutuhkan persetujuan Admin via arsaprayata72@gmail.com).
   */
  async registerOrganizer(
    name: string,
    email: string,
    password: string,
    tenantId: string,
    details: {
      nik: string;
      company_name: string;
      event_name: string;
      event_date?: string;
      event_location?: string;
      event_description?: string;
      portfolio_url?: string;
      npwp?: string;
    }
  ): Promise<AuthResult> {
    this.assertEmailNotTaken(email);

    if (!details.nik || details.nik.length < 16) {
      const err = new Error('NIK / Nomor KTP wajib 16 digit angka');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!details.company_name) {
      const err = new Error('Nama Perusahaan / Organisasi Wajib Diisi');
      (err as any).statusCode = 400;
      throw err;
    }

    const newUser: DemoUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: tenantId,
      name,
      email,
      password_hash: password,
      role: 'organizer',
      approval_status: 'pending', // PENDING ADMIN APPROVAL
      nik: details.nik,
      company_name: details.company_name,
      organizer_event_name: details.event_name,
      organizer_event_date: details.event_date || new Date().toISOString(),
      organizer_event_location: details.event_location || 'Jakarta',
      organizer_event_description: details.event_description,
      portfolio_url: details.portfolio_url,
      npwp: details.npwp,
    };

    dataStore.users.push(newUser);

    // Kirim notifikasi / Log Email ke Admin untuk Verifikasi
    console.log(
      `[ADMIN VERIFICATION EMAIL SENT TO ${env.ADMIN_EMAIL}]` +
      ` Organizer Baru Mendaftar: ${name} (${email}) | Perusahaan: ${details.company_name} | Event: ${details.event_name}` +
      ` | NIK: ${details.nik}. Mohon review & approve via Admin Dashboard.`
    );

    const token = this.generateToken(newUser);

    return {
      token,
      user: this.sanitizeUser(newUser),
    };
  }

  // ─── Login with Google ─────────────────────────────────────────────────────
  async loginWithGoogle(email: string, name: string, googleId?: string): Promise<AuthResult> {
    let user = this.findByEmail(email);

    if (!user) {
      // Auto register visitor if user signs in via Google and doesn't exist
      user = {
        id: `user-google-${crypto.randomUUID().slice(0, 8)}`,
        tenant_id: 'tenant-001',
        name,
        email,
        password_hash: `google_oauth_${crypto.randomBytes(12).toString('hex')}`,
        role: 'visitor',
        approval_status: 'approved',
      };
      dataStore.users.push(user);
    }

    const token = this.generateToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  // ─── Generic Register Router ───────────────────────────────────────────────
  async register(
    name: string,
    email: string,
    password: string,
    role: string = 'visitor',
    tenantId: string = 'tenant-001',
    extraInfo?: {
      nik?: string;
      company_name?: string;
      event_name?: string;
      event_date?: string;
      event_location?: string;
      event_description?: string;
      portfolio_url?: string;
      npwp?: string;
    }
  ): Promise<AuthResult> {
    if (role === 'organizer') {
      if (!extraInfo?.event_name || !extraInfo?.nik || !extraInfo?.company_name) {
        const err = new Error('Registrasi organizer wajib menyertakan NIK 16-digit, Nama Perusahaan, dan Nama Event');
        (err as any).statusCode = 400;
        throw err;
      }
      return this.registerOrganizer(
        name,
        email,
        password,
        tenantId,
        {
          nik: extraInfo.nik,
          company_name: extraInfo.company_name,
          event_name: extraInfo.event_name,
          event_date: extraInfo.event_date,
          event_location: extraInfo.event_location,
          event_description: extraInfo.event_description,
          portfolio_url: extraInfo.portfolio_url,
          npwp: extraInfo.npwp,
        }
      );
    } else if (role === 'visitor') {
      return this.registerVisitor(name, email, password, tenantId);
    } else {
      const err = new Error(`Role '${role}' tidak diizinkan untuk self-registration. Gate Staff didaftarkan oleh Organizer.`);
      (err as any).statusCode = 403;
      throw err;
    }
  }

  // ─── Register Gate Staff via Invitation ────────────────────────────────────
  /**
   * Organizer membuat invitation untuk gate staff.
   * Returns invitation token yang bisa dikirim via email / ditampilkan ke organizer.
   */
  async createStaffInvitation(
    organizerId: string,
    email: string,
    name: string,
    tenantId: string,
    eventId?: string
  ): Promise<{ invitation_token: string; email: string; expires_at: string }> {
    // Cek organizer valid dan approved
    const organizer = dataStore.users.find((u) => u.id === organizerId && u.role === 'organizer' && u.approval_status === 'approved');
    if (!organizer) {
      const err = new Error('Organizer tidak ditemukan atau belum diverifikasi');
      (err as any).statusCode = 403;
      throw err;
    }

    // Cek kalau email sudah ada sebagai user
    const existingUser = this.findByEmail(email);
    if (existingUser) {
      const err = new Error('Email sudah terdaftar sebagai pengguna');
      (err as any).statusCode = 409;
      throw err;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    dataStore.invitations.push({
      id: `inv-${crypto.randomUUID().slice(0, 8)}`,
      token,
      email,
      name,
      organizer_id: organizerId,
      event_id: eventId,
      tenant_id: tenantId,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

    return {
      invitation_token: token,
      email,
      expires_at: expiresAt.toISOString(),
    };
  }

  // ─── Accept Staff Invitation (Gate Staff set password) ─────────────────────
  async acceptInvitation(
    token: string,
    password: string
  ): Promise<AuthResult> {
    const invitation = dataStore.invitations.find(
      (inv) => inv.token === token && !inv.used
    );

    if (!invitation) {
      const err = new Error('Link undangan tidak valid atau sudah digunakan');
      (err as any).statusCode = 400;
      throw err;
    }

    if (new Date(invitation.expires_at) < new Date()) {
      const err = new Error('Link undangan telah kedaluwarsa. Minta organizer untuk mengirim undangan baru.');
      (err as any).statusCode = 400;
      throw err;
    }

    // Buat akun gate staff
    const newUser: DemoUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: invitation.tenant_id,
      name: invitation.name,
      email: invitation.email,
      password_hash: password,
      role: 'gate_staff',
      approval_status: 'approved',
      invited_by_organizer_id: invitation.organizer_id,
    };

    dataStore.users.push(newUser);

    // Assign ke event jika ada
    if (invitation.event_id) {
      dataStore.eventStaff.push({
        id: `evtstaff-${crypto.randomUUID().slice(0, 8)}`,
        event_id: invitation.event_id,
        user_id: newUser.id,
        role: 'gate_staff',
        assigned_at: new Date().toISOString(),
      });
    }

    // Tandai invitation sebagai sudah digunakan
    invitation.used = true;

    const authToken = this.generateToken(newUser);
    return { token: authToken, user: this.sanitizeUser(newUser) };
  }

  // ─── Admin: List Pending Organizers ─────────────────────────────────────────
  async listPendingOrganizers() {
    return dataStore.users
      .filter((u) => u.role === 'organizer' && u.approval_status === 'pending')
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        tenant_id: u.tenant_id,
        approval_status: u.approval_status,
        organizer_event_name: u.organizer_event_name,
        organizer_event_date: u.organizer_event_date,
        organizer_event_location: u.organizer_event_location,
      }));
  }

  // ─── Admin: Approve or Reject Organizer ─────────────────────────────────────
  async reviewOrganizer(
    userId: string,
    action: 'approved' | 'rejected'
  ): Promise<{ id: string; approval_status: string }> {
    const user = dataStore.users.find((u) => u.id === userId && u.role === 'organizer');
    if (!user) {
      const err = new Error('Organizer tidak ditemukan');
      (err as any).statusCode = 404;
      throw err;
    }

    user.approval_status = action;
    return { id: user.id, approval_status: user.approval_status };
  }

  // ─── Get Me ──────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = dataStore.users.find((u) => u.id === userId);
    if (!user) {
      const err = new Error('User tidak ditemukan');
      (err as any).statusCode = 404;
      throw err;
    }
    return this.sanitizeUser(user);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private findByEmail(email: string): DemoUser | undefined {
    return dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  private assertEmailNotTaken(email: string): void {
    if (this.findByEmail(email)) {
      const err = new Error('Email sudah terdaftar');
      (err as any).statusCode = 409;
      throw err;
    }
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
      approval_status: user.approval_status,
    };
  }
}

export const authService = new AuthService();
