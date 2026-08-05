"use strict";
/**
 * src/modules/notification/notification.controller.ts
 *
 * FASE 9 — Notification Service
 *
 * Dispatcher & Management endpoints:
 *   1. getMyNotifications → GET /notifications/my (list user notifications)
 *   2. sendNotification    → POST /notifications/send (manual notification broadcast by organizer/admin)
 *   3. markAsRead          → PUT /notifications/:id/read
 *   4. dispatchNotification → internal helper called by RabbitMQ consumer & controllers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
exports.dispatchNotification = dispatchNotification;
exports.getMyNotifications = getMyNotifications;
exports.sendNotification = sendNotification;
exports.markAsRead = markAsRead;
const apiResponse_1 = require("../../utils/apiResponse");
const logger_1 = require("../../utils/logger");
// In-Memory Notification Store (Dev mode)
exports.notificationStore = [
    {
        id: 'notif-demo-1',
        user_id: 'user-visitor-1',
        tenant_id: 'tenant-001',
        title: 'Selamat Datang di Soundwave Festival! 🎵',
        message: 'Tiket Anda sudah terbit. Pastikan membaca panduan gate check-in sebelum hadir di venue.',
        type: 'in_app',
        read: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
    },
];
function dispatchNotification(params) {
    const item = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
        user_id: params.userId,
        tenant_id: params.tenantId,
        title: params.title,
        message: params.message,
        type: params.type,
        read: false,
        created_at: new Date().toISOString(),
        metadata: params.metadata,
    };
    exports.notificationStore.unshift(item);
    logger_1.logger.info(`[Notification] Dispatched [${params.type.toUpperCase()}] to user ${params.userId}: "${params.title}"`);
    return item;
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications/my
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function getMyNotifications(req, res) {
    const userId = req.user?.userId;
    const userNotifs = exports.notificationStore.filter((n) => n.user_id === userId || n.user_id === 'all');
    const unreadCount = userNotifs.filter((n) => !n.read).length;
    res.json(apiResponse_1.ApiResponse.success({
        notifications: userNotifs,
        unread_count: unreadCount,
    }, 'User notifications retrieved'));
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/send
// Body: { target_user_id?, title, message, type? }
// Auth: requireRole(['organizer', 'admin', 'superadmin'])
// ─────────────────────────────────────────────────────────────────────────────
async function sendNotification(req, res) {
    const { target_user_id = 'all', title, message, type = 'in_app', metadata } = req.body;
    if (!title || !message) {
        res.status(400).json(apiResponse_1.ApiResponse.error('title and message are required', 400));
        return;
    }
    const notif = dispatchNotification({
        userId: target_user_id,
        tenantId: req.user?.tenantId || 'tenant-001',
        title,
        message,
        type,
        metadata,
    });
    res.json(apiResponse_1.ApiResponse.success(notif, 'Notification dispatched successfully'));
}
// ─────────────────────────────────────────────────────────────────────────────
// PUT /notifications/:id/read
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function markAsRead(req, res) {
    const { id } = req.params;
    const notif = exports.notificationStore.find((n) => n.id === id);
    if (!notif) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Notification not found', 404));
        return;
    }
    notif.read = true;
    res.json(apiResponse_1.ApiResponse.success(notif, 'Notification marked as read'));
}
//# sourceMappingURL=notification.controller.js.map