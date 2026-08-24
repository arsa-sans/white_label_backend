/**
 * src/modules/promo/promo.routes.ts
 *
 * Routes for Promo & Voucher endpoints.
 */

import { Router } from 'express';
import {
  listPromos,
  getPromoById,
  createPromo,
  updatePromo,
  deletePromo,
  validatePromoCode,
} from './promo.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';

const router = Router();

// Public / visitor validation route at checkout
router.post('/validate', validatePromoCode);

// Organizer & Admin protected routes
router.get('/', authenticate, requireRole(['organizer', 'admin', 'superadmin']), listPromos);
router.post('/', authenticate, requireRole(['organizer', 'admin', 'superadmin']), createPromo);
router.get('/:id', authenticate, requireRole(['organizer', 'admin', 'superadmin']), getPromoById);
router.put('/:id', authenticate, requireRole(['organizer', 'admin', 'superadmin']), updatePromo);
router.delete('/:id', authenticate, requireRole(['organizer', 'admin', 'superadmin']), deletePromo);

export default router;
