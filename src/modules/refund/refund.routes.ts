/**
 * src/modules/refund/refund.routes.ts
 *
 * Express routes for Refund & Reschedule management.
 */

import { Router } from 'express';
import {
  createRefundRequest,
  listMyRefunds,
  listAllRefunds,
  getRefundById,
  reviewRefundRequest,
} from './refund.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Buyer endpoints
router.post('/', authenticate, createRefundRequest);
router.get('/my', authenticate, listMyRefunds);

// Organizer / Admin endpoints
router.get('/', authenticate, listAllRefunds);
router.get('/:id', authenticate, getRefundById);
router.patch('/:id/review', authenticate, reviewRefundRequest);

export default router;
