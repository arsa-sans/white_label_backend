"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.inviteStaff = inviteStaff;
exports.acceptInvitation = acceptInvitation;
exports.getMe = getMe;
const apiResponse_1 = require("../../utils/apiResponse");
const auth_service_1 = require("./auth.service");
async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json(apiResponse_1.ApiResponse.error('Email dan password wajib diisi', 400));
            return;
        }
        const result = await auth_service_1.authService.login(email, password);
        res.json(apiResponse_1.ApiResponse.success(result, 'Login berhasil'));
    }
    catch (error) {
        const status = error.statusCode || 401;
        res.status(status).json(apiResponse_1.ApiResponse.error(error.message || 'Login gagal', status));
    }
}
async function register(req, res) {
    try {
        const { name, email, password, role = 'visitor', event_name, event_date, event_location } = req.body;
        if (!name || !email || !password) {
            res.status(400).json(apiResponse_1.ApiResponse.error('Nama, email, dan password wajib diisi', 400));
            return;
        }
        const tenantId = req.tenantId || req.tenant?.id || 'tenant-001';
        const result = await auth_service_1.authService.register(name, email, password, role, tenantId, { event_name, event_date, event_location });
        res.status(201).json(apiResponse_1.ApiResponse.success(result, 'Registrasi berhasil'));
    }
    catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json(apiResponse_1.ApiResponse.error(error.message || 'Registrasi gagal', status));
    }
}
async function inviteStaff(req, res) {
    try {
        const organizerId = req.user?.userId;
        const tenantId = req.user?.tenantId || 'tenant-001';
        const { email, name, event_id } = req.body;
        if (!email || !name) {
            res.status(400).json(apiResponse_1.ApiResponse.error('Email dan nama staff wajib diisi', 400));
            return;
        }
        const result = await auth_service_1.authService.createStaffInvitation(organizerId, email, name, tenantId, event_id);
        res.status(201).json(apiResponse_1.ApiResponse.success(result, 'Undangan gate staff berhasil dibuat'));
    }
    catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json(apiResponse_1.ApiResponse.error(error.message || 'Gagal mengundang staff', status));
    }
}
async function acceptInvitation(req, res) {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            res.status(400).json(apiResponse_1.ApiResponse.error('Token undangan dan password wajib diisi', 400));
            return;
        }
        const result = await auth_service_1.authService.acceptInvitation(token, password);
        res.json(apiResponse_1.ApiResponse.success(result, 'Akun gate staff berhasil diaktifkan'));
    }
    catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json(apiResponse_1.ApiResponse.error(error.message || 'Gagal menerima undangan', status));
    }
}
async function getMe(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json(apiResponse_1.ApiResponse.error('Unauthorized', 401));
            return;
        }
        const user = await auth_service_1.authService.getMe(userId);
        res.json(apiResponse_1.ApiResponse.success(user));
    }
    catch (error) {
        const status = error.statusCode || 404;
        res.status(status).json(apiResponse_1.ApiResponse.error(error.message || 'User tidak ditemukan', status));
    }
}
//# sourceMappingURL=auth.controller.js.map