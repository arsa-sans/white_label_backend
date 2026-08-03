import { Router } from 'express';

// Auth routes — implemented in Phase 2
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ module: 'auth', status: 'ok' });
});

export default router;
