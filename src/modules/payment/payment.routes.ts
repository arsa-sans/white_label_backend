import { Router } from 'express';
import { createOrder, processPayment } from './payment.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/orders', authenticate, createOrder);
router.post('/orders/:id/pay', authenticate, processPayment);

export default router;
