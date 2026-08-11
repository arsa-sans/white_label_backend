"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../../config/env");
const dataStore_1 = require("../../database/dataStore");
// ─── Allowed public register roles ───────────────────────────────────────────
const PUBLIC_REGISTER_ROLES = ['visitor', 'organizer'];
class AuthService {
    // ─── Login ──────────────────────────────────────────────────────────────────
    async login(email, password) {
        const user = this.findByEmail(email);
        if (!user || user.password_hash !== password) {
            const err = new Error('Email atau password salah');
            err.statusCode = 401;
            throw err;
        }
        // Organizer yang masih pending tidak bisa login
        if (user.role === 'organizer' && user.approval_status === 'pending') {
            const err = new Error('Akun organizer Anda sedang menunggu verifikasi admin. Mohon bersabar.');
            err.statusCode = 403;
            throw err;
        }
        // Organizer yang ditolak tidak bisa login
        if (user.role === 'organizer' && user.approval_status === 'rejected') {
            const err = new Error('Pendaftaran akun organizer Anda telah ditolak. Hubungi admin untuk informasi lebih lanjut.');
            err.statusCode = 403;
            throw err;
        }
        const token = this.generateToken(user);
        return { token, user: this.sanitizeUser(user) };
    }
    // ─── Register Visitor ────────────────────────────────────────────────────────
    async registerVisitor(name, email, password, tenantId) {
        this.assertEmailNotTaken(email);
        const newUser = {
            id: `user-${crypto_1.default.randomUUID().slice(0, 8)}`,
            tenant_id: tenantId,
            name,
            email,
            password_hash: password,
            role: 'visitor',
            approval_status: 'approved',
        };
        dataStore_1.dataStore.users.push(newUser);
        const token = this.generateToken(newUser);
        return { token, user: this.sanitizeUser(newUser) };
    }
    // ─── Register Organizer ──────────────────────────────────────────────────────
    /**
     * Organizer register: Wajib menyertakan info event sebagai bukti verifikasi.
     * Soft validation: approval_status langsung 'approved'.
     */
    async registerOrganizer(name, email, password, tenantId, eventName, eventDate, eventLocation) {
        this.assertEmailNotTaken(email);
        const newUser = {
            id: `user-${crypto_1.default.randomUUID().slice(0, 8)}`,
            tenant_id: tenantId,
            name,
            email,
            password_hash: password,
            role: 'organizer',
            approval_status: 'approved',
            organizer_event_name: eventName,
            organizer_event_date: eventDate || new Date().toISOString(),
            organizer_event_location: eventLocation || 'Jakarta',
        };
        dataStore_1.dataStore.users.push(newUser);
        const token = this.generateToken(newUser);
        return {
            token,
            user: this.sanitizeUser(newUser),
        };
    }
    // ─── Generic Register Router ───────────────────────────────────────────────
    async register(name, email, password, role = 'visitor', tenantId = 'tenant-001', extraInfo) {
        if (role === 'organizer') {
            if (!extraInfo?.event_name) {
                const err = new Error('Registrasi organizer wajib menyertakan Nama Event sebagai verifikasi');
                err.statusCode = 400;
                throw err;
            }
            return this.registerOrganizer(name, email, password, tenantId, extraInfo.event_name, extraInfo.event_date, extraInfo.event_location);
        }
        else if (role === 'visitor') {
            return this.registerVisitor(name, email, password, tenantId);
        }
        else {
            const err = new Error(`Role '${role}' tidak diizinkan untuk self-registration. Gate Staff didaftarkan oleh Organizer.`);
            err.statusCode = 403;
            throw err;
        }
    }
    // ─── Register Gate Staff via Invitation ────────────────────────────────────
    /**
     * Organizer membuat invitation untuk gate staff.
     * Returns invitation token yang bisa dikirim via email / ditampilkan ke organizer.
     */
    async createStaffInvitation(organizerId, email, name, tenantId, eventId) {
        // Cek organizer valid dan approved
        const organizer = dataStore_1.dataStore.users.find((u) => u.id === organizerId && u.role === 'organizer' && u.approval_status === 'approved');
        if (!organizer) {
            const err = new Error('Organizer tidak ditemukan atau belum diverifikasi');
            err.statusCode = 403;
            throw err;
        }
        // Cek kalau email sudah ada sebagai user
        const existingUser = this.findByEmail(email);
        if (existingUser) {
            const err = new Error('Email sudah terdaftar sebagai pengguna');
            err.statusCode = 409;
            throw err;
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari
        dataStore_1.dataStore.invitations.push({
            id: `inv-${crypto_1.default.randomUUID().slice(0, 8)}`,
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
    async acceptInvitation(token, password) {
        const invitation = dataStore_1.dataStore.invitations.find((inv) => inv.token === token && !inv.used);
        if (!invitation) {
            const err = new Error('Link undangan tidak valid atau sudah digunakan');
            err.statusCode = 400;
            throw err;
        }
        if (new Date(invitation.expires_at) < new Date()) {
            const err = new Error('Link undangan telah kedaluwarsa. Minta organizer untuk mengirim undangan baru.');
            err.statusCode = 400;
            throw err;
        }
        // Buat akun gate staff
        const newUser = {
            id: `user-${crypto_1.default.randomUUID().slice(0, 8)}`,
            tenant_id: invitation.tenant_id,
            name: invitation.name,
            email: invitation.email,
            password_hash: password,
            role: 'gate_staff',
            approval_status: 'approved',
            invited_by_organizer_id: invitation.organizer_id,
        };
        dataStore_1.dataStore.users.push(newUser);
        // Assign ke event jika ada
        if (invitation.event_id) {
            dataStore_1.dataStore.eventStaff.push({
                id: `evtstaff-${crypto_1.default.randomUUID().slice(0, 8)}`,
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
        return dataStore_1.dataStore.users
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
    async reviewOrganizer(userId, action) {
        const user = dataStore_1.dataStore.users.find((u) => u.id === userId && u.role === 'organizer');
        if (!user) {
            const err = new Error('Organizer tidak ditemukan');
            err.statusCode = 404;
            throw err;
        }
        user.approval_status = action;
        return { id: user.id, approval_status: user.approval_status };
    }
    // ─── Get Me ──────────────────────────────────────────────────────────────────
    async getMe(userId) {
        const user = dataStore_1.dataStore.users.find((u) => u.id === userId);
        if (!user) {
            const err = new Error('User tidak ditemukan');
            err.statusCode = 404;
            throw err;
        }
        return this.sanitizeUser(user);
    }
    // ─── Private Helpers ─────────────────────────────────────────────────────────
    findByEmail(email) {
        return dataStore_1.dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    }
    assertEmailNotTaken(email) {
        if (this.findByEmail(email)) {
            const err = new Error('Email sudah terdaftar');
            err.statusCode = 409;
            throw err;
        }
    }
    generateToken(user) {
        return jsonwebtoken_1.default.sign({
            userId: user.id,
            tenantId: user.tenant_id,
            role: user.role,
            email: user.email,
        }, env_1.env.JWT_SECRET, { expiresIn: '7d' });
    }
    sanitizeUser(user) {
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
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map