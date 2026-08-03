import { Router } from 'express';
const router = Router();
router.get('/health', (_req, res) => res.json({ module: 'analytics', status: 'ok' }));
export default router;
