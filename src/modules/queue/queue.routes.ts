/**
 * src/modules/queue/queue.routes.ts
 *
 * Virtual Waiting Room routes.
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  joinQueue,
  getQueueStatus,
  validateCheckoutSession,
  admitQueue,
} from './queue.controller';

const router = Router();

router.post('/join', authenticate, joinQueue);
router.get('/status', authenticate, getQueueStatus);
router.get('/validate-session', authenticate, validateCheckoutSession);
router.post('/admit', authenticate, requireRole(['organizer', 'admin', 'superadmin']), admitQueue);

export default router;
