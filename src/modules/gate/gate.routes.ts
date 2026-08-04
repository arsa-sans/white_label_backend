import { Router } from 'express';
import { validateGateScan, syncGateLogs } from './gate.controller';

const router = Router();

router.post('/validate', validateGateScan);
router.post('/sync-logs', syncGateLogs);

export default router;
