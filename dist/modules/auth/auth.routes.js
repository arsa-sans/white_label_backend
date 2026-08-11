"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});
router.post('/login', auth_controller_1.login);
router.post('/register', auth_controller_1.register);
router.post('/invite-staff', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin']), auth_controller_1.inviteStaff);
router.post('/accept-invitation', auth_controller_1.acceptInvitation);
router.get('/me', auth_middleware_1.authenticate, auth_controller_1.getMe);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map