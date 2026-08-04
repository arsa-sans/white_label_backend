import { Router } from 'express';
import { lockSeat, getMyTickets, getDynamicQrToken } from './ticket.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/lock-seat', authenticate, lockSeat);
router.get('/my-tickets', authenticate, getMyTickets);
router.get('/:id/qr-token', authenticate, getDynamicQrToken);

export default router;
