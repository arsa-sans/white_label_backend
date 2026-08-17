/**
 * src/modules/queue/queue.service.ts
 *
 * Virtual Waiting Room Service (Redis ZSET + In-Memory Fallback).
 */

import crypto from 'crypto';
import { redis } from '../../config/redis';
import { dataStore } from '../../database/dataStore';
import { io } from '../../server';
import { logger } from '../../utils/logger';
import { QueueEntry, JoinQueueResult, QueueStatusResult } from './queue.types';

const ADMITTED_TTL_MS = 10 * 60 * 1000; // 10 minutes session TTL

class InMemQueue {
  private queues: Map<string, QueueEntry[]> = new Map(); // eventId -> entries sorted by timestamp
  private admitted: Map<string, QueueEntry> = new Map(); // sessionId -> entry

  public join(eventId: string, userId: string): { sessionId: string; rank: number; admitted: boolean } {
    let list = this.queues.get(eventId) || [];

    // Check if already admitted
    const existingAdmitted = Array.from(this.admitted.values()).find(
      (e) => e.eventId === eventId && e.userId === userId && e.admittedAt! + ADMITTED_TTL_MS > Date.now()
    );
    if (existingAdmitted) {
      return { sessionId: existingAdmitted.sessionId, rank: 0, admitted: true };
    }

    // Check if already in queue
    const existing = list.find((e) => e.userId === userId);
    if (existing) {
      const rank = list.findIndex((e) => e.userId === userId) + 1;
      return { sessionId: existing.sessionId, rank, admitted: false };
    }

    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const entry: QueueEntry = { sessionId, userId, eventId, timestamp: Date.now() };
    list.push(entry);
    this.queues.set(eventId, list);

    return { sessionId, rank: list.length, admitted: false };
  }

  public getStatus(eventId: string, sessionId: string): { rank: number; total: number; admitted: boolean } {
    const adm = this.admitted.get(sessionId);
    if (adm && adm.admittedAt! + ADMITTED_TTL_MS > Date.now()) {
      return { rank: 0, total: 0, admitted: true };
    }

    const list = this.queues.get(eventId) || [];
    const index = list.findIndex((e) => e.sessionId === sessionId);
    if (index === -1) {
      return { rank: -1, total: list.length, admitted: false };
    }

    return { rank: index + 1, total: list.length, admitted: false };
  }

  public admit(eventId: string, count: number): number {
    const list = this.queues.get(eventId) || [];
    const toAdmit = list.splice(0, count);
    let admittedCount = 0;

    for (const item of toAdmit) {
      item.admittedAt = Date.now();
      this.admitted.set(item.sessionId, item);
      admittedCount++;
    }

    this.queues.set(eventId, list);
    return admittedCount;
  }
}

const inMemQueue = new InMemQueue();

function isRedisReady(): boolean {
  return redis.status === 'ready';
}

export class QueueService {
  public async joinQueue(eventId: string, userId: string): Promise<JoinQueueResult> {
    const timestamp = Date.now();
    const sessionId = `sess-${userId}-${eventId}`;

    if (isRedisReady()) {
      try {
        const admittedKey = `queue:admitted:${eventId}:${sessionId}`;
        const isAdmitted = await redis.get(admittedKey);
        if (isAdmitted) {
          return {
            sessionId,
            eventId,
            rank: 0,
            admitted: true,
            expiresInSeconds: 600,
          };
        }

        const queueKey = `queue:${eventId}`;
        await redis.zadd(queueKey, timestamp, sessionId);
        const rank = (await redis.zrank(queueKey, sessionId)) ?? 0;

        return {
          sessionId,
          eventId,
          rank: rank + 1,
          admitted: false,
          estimatedWaitSeconds: (rank + 1) * 3,
        };
      } catch (err) {
        logger.warn('[Queue] Redis error, falling back to in-memory queue', err);
      }
    }

    const resData = inMemQueue.join(eventId, userId);
    return {
      sessionId: resData.sessionId,
      eventId,
      rank: resData.rank,
      admitted: resData.admitted,
      estimatedWaitSeconds: resData.rank * 3,
    };
  }

  public async getQueueStatus(eventId: string, sessionId: string): Promise<QueueStatusResult> {
    if (isRedisReady()) {
      try {
        const admittedKey = `queue:admitted:${eventId}:${sessionId}`;
        const isAdmitted = await redis.get(admittedKey);
        if (isAdmitted) {
          const ttl = await redis.ttl(admittedKey);
          return {
            sessionId,
            eventId,
            rank: 0,
            total: 0,
            admitted: true,
            expiresInSeconds: ttl > 0 ? ttl : 600,
          };
        }

        const queueKey = `queue:${eventId}`;
        const rank = await redis.zrank(queueKey, sessionId);
        const total = await redis.zcard(queueKey);

        if (rank === null) {
          return {
            sessionId,
            eventId,
            rank: -1,
            total,
            admitted: false,
          };
        }

        return {
          sessionId,
          eventId,
          rank: rank + 1,
          total,
          admitted: false,
          estimatedWaitSeconds: (rank + 1) * 3,
        };
      } catch (err) {
        logger.warn('[Queue] Redis getQueueStatus fallback to in-memory', err);
      }
    }

    const status = inMemQueue.getStatus(eventId, sessionId);
    return {
      sessionId,
      eventId,
      rank: status.rank,
      total: status.total,
      admitted: status.admitted,
      estimatedWaitSeconds: Math.max(status.rank, 0) * 3,
    };
  }

  public async admitQueue(eventId: string, count: number = 50): Promise<number> {
    let admittedCount = 0;

    if (isRedisReady()) {
      try {
        const queueKey = `queue:${eventId}`;
        const sessions = await redis.zrange(queueKey, 0, count - 1);

        if (sessions.length > 0) {
          for (const sess of sessions) {
            const admittedKey = `queue:admitted:${eventId}:${sess}`;
            await redis.setex(admittedKey, 600, 'true');
            await redis.zrem(queueKey, sess);
            admittedCount++;
          }
        }
      } catch (err) {
        logger.warn('[Queue] Redis admit failed', err);
      }
    } else {
      admittedCount = inMemQueue.admit(eventId, count);
    }

    // Broadcast admission update via Socket.IO
    io.to(`event:${eventId}`).emit('queue_admitted', {
      event_id: eventId,
      admitted_count: admittedCount,
      timestamp: new Date().toISOString(),
    });

    return admittedCount;
  }
}

export const queueService = new QueueService();
