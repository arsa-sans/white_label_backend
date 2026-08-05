"use strict";
/**
 * src/modules/notification/notification.routes.ts
 *
 * FASE 9 — Notification Service routes
 *
 * Endpoints:
 *   GET  /notifications/my       — daftar notifikasi user login
 *   POST /notifications/send     — manual broadcast notifikasi (organizer/admin)
 *   PUT  /notifications/:id/read — tandai notifikasi dibaca
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const notification_controller_1 = require("./notification.controller");
const router = (0, express_1.Router)();
router.get('/my', auth_middleware_1.authenticate, notification_controller_1.getMyNotifications);
router.post('/send', auth_middleware_1.authenticate, (0, rbac_middleware_1.requireRole)(['organizer', 'admin', 'superadmin']), notification_controller_1.sendNotification);
router.put('/:id/read', auth_middleware_1.authenticate, notification_controller_1.markAsRead);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map