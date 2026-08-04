import { Router } from 'express';
import { listEvents, getEventById, getEventSeats } from './event.controller';

const router = Router();

router.get('/', listEvents);
router.get('/:id', getEventById);
router.get('/:id/seats', getEventSeats);

export default router;
