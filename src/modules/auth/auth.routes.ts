import { Router } from 'express';
import { login, register, getMe, inviteStaff, acceptInvitation } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ module: 'auth', status: 'ok' });
});

router.post('/login', login);
router.post('/register', register);
router.post('/invite-staff', authenticate, requireRole(['organizer', 'admin']), inviteStaff);
router.post('/accept-invitation', acceptInvitation);
router.get('/me', authenticate, getMe);

export default router;

