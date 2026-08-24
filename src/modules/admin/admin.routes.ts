/**
 * src/modules/admin/admin.routes.ts
 *
 * Super Admin Routes.
 */

import { Router } from 'express';
import {
  getPlatformStats,
  listTenants,
  createTenant,
  listOrganizers,
  reviewOrganizer,
  listAuditLogs,
} from './admin.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';

const router = Router();

// Protect all admin routes with authentication and role check
router.use(authenticate);
router.use(requireRole(['admin', 'superadmin']));

router.get('/stats', getPlatformStats);
router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/organizers', listOrganizers);
router.patch('/organizers/:userId/review', reviewOrganizer);
router.get('/audit-logs', listAuditLogs);

export default router;
