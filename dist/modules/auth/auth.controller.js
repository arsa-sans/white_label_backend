"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.getMe = getMe;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json(apiResponse_1.ApiResponse.error('Email and password are required', 400));
        return;
    }
    const user = dataStore_1.dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password_hash !== password) {
        res.status(401).json(apiResponse_1.ApiResponse.error('Invalid email or password', 401));
        return;
    }
    const token = jsonwebtoken_1.default.sign({
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        email: user.email,
    }, env_1.env.JWT_SECRET, { expiresIn: '7d' });
    res.json(apiResponse_1.ApiResponse.success({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
        },
    }, 'Login successful'));
}
async function register(req, res) {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        res.status(400).json(apiResponse_1.ApiResponse.error('Name, email, and password are required', 400));
        return;
    }
    const existing = dataStore_1.dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        res.status(409).json(apiResponse_1.ApiResponse.error('User with this email already exists', 409));
        return;
    }
    const newUser = {
        id: `user-${Date.now()}`,
        tenant_id: req.tenant?.id || 'tenant-001',
        name,
        email,
        password_hash: password,
        role: (role || 'visitor'),
    };
    dataStore_1.dataStore.users.push(newUser);
    const token = jsonwebtoken_1.default.sign({
        userId: newUser.id,
        tenantId: newUser.tenant_id,
        role: newUser.role,
        email: newUser.email,
    }, env_1.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json(apiResponse_1.ApiResponse.success({
        token,
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            tenant_id: newUser.tenant_id,
        },
    }, 'Registration successful'));
}
async function getMe(req, res) {
    const userId = req.user?.userId;
    const user = dataStore_1.dataStore.users.find((u) => u.id === userId);
    if (!user) {
        res.status(444).json(apiResponse_1.ApiResponse.error('User not found', 404));
        return;
    }
    res.json(apiResponse_1.ApiResponse.success({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
    }));
}
//# sourceMappingURL=auth.controller.js.map