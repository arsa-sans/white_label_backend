import { Router } from 'express';
import { getWallet, topupWallet } from './cashless.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/wallet', authenticate, getWallet);
router.post('/topup', authenticate, topupWallet);

export default router;
