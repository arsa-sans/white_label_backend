import { Router } from 'express';
import { login, register, getMe } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ module: 'auth', status: 'ok' });
});

router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, getMe);

export default router;
