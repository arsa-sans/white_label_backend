/**
 * src/modules/queue/queue.controller.ts
 *
 * Virtual Waiting Room Controller.
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { dataStore } from '../../database/dataStore';
import { queueService } from './queue.service';

export async function joinQueue(req: Request, res: Response): Promise<void> {
  const { event_id } = req.body;
  const userId = req.user?.userId;

  if (!event_id) {
    res.status(400).json(ApiResponse.error('event_id is required', 400));
    return;
  }

  if (!userId) {
    res.status(401).json(ApiResponse.error('Unauthorized', 401));
    return;
  }

  const event = dataStore.events.find((e) => e.id === event_id);
  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  const result = await queueService.joinQueue(event_id, userId);
  res.json(
    ApiResponse.success(
      {
        session_id: result.sessionId,
        event_id: result.eventId,
        rank: result.rank,
        admitted: result.admitted,
        estimated_wait_seconds: result.estimatedWaitSeconds,
        expires_in_seconds: result.expiresInSeconds,
      },
      result.admitted ? 'Admitted to checkout' : 'Joined virtual queue successfully'
    )
  );
}

export async function getQueueStatus(req: Request, res: Response): Promise<void> {
  const event_id = req.query.event_id as string;
  const session_id = (req.query.session_id as string) || `sess-${req.user?.userId}-${event_id}`;

  if (!event_id) {
    res.status(400).json(ApiResponse.error('event_id is required', 400));
    return;
  }

  const result = await queueService.getQueueStatus(event_id, session_id);
  res.json(
    ApiResponse.success(
      {
        session_id: result.sessionId,
        event_id: result.eventId,
        rank: result.rank,
        total: result.total,
        admitted: result.admitted,
        estimated_wait_seconds: result.estimatedWaitSeconds,
        expires_in_seconds: result.expiresInSeconds,
      },
      'Queue status retrieved'
    )
  );
}

export async function admitQueue(req: Request, res: Response): Promise<void> {
  const { event_id, count = 50 } = req.body;

  if (!event_id) {
    res.status(400).json(ApiResponse.error('event_id is required', 400));
    return;
  }

  const admittedCount = await queueService.admitQueue(event_id, count);
  res.json(
    ApiResponse.success(
      {
        event_id,
        admitted_count: admittedCount,
      },
      `Admitted ${admittedCount} user(s) to checkout`
    )
  );
}
