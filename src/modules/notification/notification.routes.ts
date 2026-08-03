import { Router } from 'express';
const router = Router();
router.get('/health', (_req, res) => res.json({ module: 'notification', status: 'ok' }));
export default router;
