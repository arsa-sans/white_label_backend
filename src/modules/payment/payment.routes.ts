import { Router } from 'express';
const router = Router();
router.get('/health', (_req, res) => res.json({ module: 'payment', status: 'ok' }));
export default router;
