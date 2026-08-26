/**
 * src/modules/queue/queue.service.ts
 *
 * Virtual Waiting Room Service with Auto-Admit & Checkout Session TTL.
 * Redis ZSET + In-Memory Fallback.
 */

import crypto from 'crypto';
import { redis } from '../../config/redis';
import { dataStore } from '../../database/dataStore';
import { io } from '../../server';
import { logger } from '../../utils/logger';
import { QueueEntry, JoinQueueResult, QueueStatusResult } from './queue.types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_WAIT_SECONDS = 5;          // Minimum wait even for rank 1
const WAIT_PER_RANK_SECONDS = 3;     // Additional seconds per rank position
const CHECKOUT_SESSION_TTL = 60;     // 1 minute checkout session
const MAX_CONCURRENT_CHECKOUT = 2;   // Max concurrent users in checkout (demo)
const ADMITTED_TTL_MS = CHECKOUT_SESSION_TTL * 1000;

// ─── In-Memory Queue Fallback ────────────────────────────────────────────────
class InMemQueue {
  private queues: Map<string, QueueEntry[]> = new Map();
  private admitted: Map<string, QueueEntry> = new Map();
  private admitTimers: Map<string, NodeJS.Timeout> = new Map();

  public join(eventId: string, userId: string): { sessionId: string; rank: number; admitted: boolean } {
    let list = this.queues.get(eventId) || [];

    // Check if already admitted and session still valid
    const existingAdmitted = Array.from(this.admitted.values()).find(
      (e) => e.eventId === eventId && e.userId === userId && e.admittedAt! + ADMITTED_TTL_MS > Date.now()
    );
    if (existingAdmitted) {
      return { sessionId: existingAdmitted.sessionId, rank: 0, admitted: true };
    }

    // Clean up expired admitted entries
    this.cleanupExpiredAdmitted();

    // Check if already in queue
    const existing = list.find((e) => e.userId === userId);
    if (existing) {
      const rank = list.findIndex((e) => e.userId === userId) + 1;
      return { sessionId: existing.sessionId, rank, admitted: false };
    }

    const sessionId = `sess-${userId}-${eventId}`;
    const entry: QueueEntry = { sessionId, userId, eventId, timestamp: Date.now() };
    list.push(entry);
    this.queues.set(eventId, list);

    const rank = list.length;
    const activeCheckouts = this.getActiveCheckoutCount(eventId);

    // Schedule auto-admit
    const waitSeconds = Math.max(MIN_WAIT_SECONDS, rank * WAIT_PER_RANK_SECONDS);
    this.scheduleAutoAdmit(eventId, sessionId, userId, waitSeconds);

    return { sessionId, rank, admitted: false };
  }

  private scheduleAutoAdmit(eventId: string, sessionId: string, userId: string, delaySec: number): void {
    const timerKey = `${eventId}:${sessionId}`;
    // Clear existing timer if any
    const existingTimer = this.admitTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.tryAutoAdmit(eventId, sessionId, userId);
    }, delaySec * 1000);

    this.admitTimers.set(timerKey, timer);
  }

  private tryAutoAdmit(eventId: string, sessionId: string, userId: string): void {
    this.cleanupExpiredAdmitted();
    const activeCount = this.getActiveCheckoutCount(eventId);

    if (activeCount >= MAX_CONCURRENT_CHECKOUT) {
      // Retry in 2 seconds
      this.scheduleAutoAdmit(eventId, sessionId, userId, 2);
      return;
    }

    const list = this.queues.get(eventId) || [];
    const entryIndex = list.findIndex((e) => e.sessionId === sessionId);
    if (entryIndex === -1) return; // Already removed

    const entry = list.splice(entryIndex, 1)[0];
    entry.admittedAt = Date.now();
    this.admitted.set(sessionId, entry);
    this.queues.set(eventId, list);

    // Clean up timer
    this.admitTimers.delete(`${eventId}:${sessionId}`);

    // Notify via Socket.IO
    io.to(`event:${eventId}`).emit('queue_admitted', {
      event_id: eventId,
      session_id: sessionId,
      user_id: userId,
      checkout_ttl_seconds: CHECKOUT_SESSION_TTL,
      timestamp: new Date().toISOString(),
    });

    logger.info(`[Queue] Auto-admitted user ${userId} for event ${eventId}`);
  }

  private cleanupExpiredAdmitted(): void {
    const now = Date.now();
    for (const [key, entry] of this.admitted.entries()) {
      if (entry.admittedAt && entry.admittedAt + ADMITTED_TTL_MS <= now) {
        this.admitted.delete(key);
      }
    }
  }

  public getActiveCheckoutCount(eventId: string): number {
    this.cleanupExpiredAdmitted();
    let count = 0;
    for (const entry of this.admitted.values()) {
      if (entry.eventId === eventId) count++;
    }
    return count;
  }

  public getStatus(eventId: string, sessionId: string): { rank: number; total: number; admitted: boolean; admittedAt?: number } {
    const adm = this.admitted.get(sessionId);
    if (adm && adm.admittedAt! + ADMITTED_TTL_MS > Date.now()) {
      return { rank: 0, total: 0, admitted: true, admittedAt: adm.admittedAt };
    }

    const list = this.queues.get(eventId) || [];
    const index = list.findIndex((e) => e.sessionId === sessionId);
    if (index === -1) {
      return { rank: -1, total: list.length, admitted: false };
    }

    return { rank: index + 1, total: list.length, admitted: false };
  }

  public isSessionValid(eventId: string, sessionId: string): { valid: boolean; remainingSeconds: number } {
    const adm = this.admitted.get(sessionId);
    if (!adm || !adm.admittedAt) {
      return { valid: false, remainingSeconds: 0 };
    }

    const elapsed = Date.now() - adm.admittedAt;
    const remaining = ADMITTED_TTL_MS - elapsed;

    if (remaining <= 0) {
      this.admitted.delete(sessionId);
      return { valid: false, remainingSeconds: 0 };
    }

    return { valid: true, remainingSeconds: Math.ceil(remaining / 1000) };
  }

  // Keep legacy admit method for manual admission by organizer
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
        // Check if already admitted
        const admittedKey = `queue:admitted:${eventId}:${sessionId}`;
        const isAdmitted = await redis.get(admittedKey);
        if (isAdmitted) {
          const ttl = await redis.ttl(admittedKey);
          return {
            sessionId,
            eventId,
            rank: 0,
            admitted: true,
            expiresInSeconds: ttl > 0 ? ttl : CHECKOUT_SESSION_TTL,
            checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
          };
        }

        // Add to queue
        const queueKey = `queue:${eventId}`;
        await redis.zadd(queueKey, timestamp, sessionId);
        const rank = (await redis.zrank(queueKey, sessionId)) ?? 0;
        const activeCheckouts = await this.getActiveCheckoutCountRedis(eventId);

        // Calculate wait time
        const waitSeconds = Math.max(MIN_WAIT_SECONDS, (rank + 1) * WAIT_PER_RANK_SECONDS);

        // Schedule auto-admit
        this.scheduleRedisAutoAdmit(eventId, sessionId, userId, waitSeconds);

        return {
          sessionId,
          eventId,
          rank: rank + 1,
          admitted: false,
          estimatedWaitSeconds: waitSeconds,
          checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
          activeCheckouts,
        };
      } catch (err) {
        logger.warn('[Queue] Redis error, falling back to in-memory queue', err);
      }
    }

    // Fallback to in-memory
    const resData = inMemQueue.join(eventId, userId);
    const activeCheckouts = inMemQueue.getActiveCheckoutCount(eventId);
    const waitSeconds = Math.max(MIN_WAIT_SECONDS, resData.rank * WAIT_PER_RANK_SECONDS);

    return {
      sessionId: resData.sessionId,
      eventId,
      rank: resData.rank,
      admitted: resData.admitted,
      estimatedWaitSeconds: resData.admitted ? undefined : waitSeconds,
      checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
      activeCheckouts,
    };
  }

  private scheduleRedisAutoAdmit(eventId: string, sessionId: string, userId: string, delaySec: number): void {
    setTimeout(async () => {
      try {
        await this.tryRedisAutoAdmit(eventId, sessionId, userId);
      } catch (err) {
        logger.warn('[Queue] Redis auto-admit error', err);
      }
    }, delaySec * 1000);
  }

  private async tryRedisAutoAdmit(eventId: string, sessionId: string, userId: string): Promise<void> {
    if (!isRedisReady()) {
      // Fallback: try in-memory
      inMemQueue['tryAutoAdmit'](eventId, sessionId, userId);
      return;
    }

    const activeCount = await this.getActiveCheckoutCountRedis(eventId);
    if (activeCount >= MAX_CONCURRENT_CHECKOUT) {
      // Retry in 2 seconds
      this.scheduleRedisAutoAdmit(eventId, sessionId, userId, 2);
      return;
    }

    const queueKey = `queue:${eventId}`;
    const admittedKey = `queue:admitted:${eventId}:${sessionId}`;

    // Check if still in queue
    const rank = await redis.zrank(queueKey, sessionId);
    if (rank === null) return; // Already removed

    // Remove from queue and admit
    await redis.zrem(queueKey, sessionId);
    await redis.setex(admittedKey, CHECKOUT_SESSION_TTL, JSON.stringify({ userId, admittedAt: Date.now() }));

    // Notify via Socket.IO
    io.to(`event:${eventId}`).emit('queue_admitted', {
      event_id: eventId,
      session_id: sessionId,
      user_id: userId,
      checkout_ttl_seconds: CHECKOUT_SESSION_TTL,
      timestamp: new Date().toISOString(),
    });

    logger.info(`[Queue] Redis auto-admitted user ${userId} for event ${eventId}`);
  }

  private async getActiveCheckoutCountRedis(eventId: string): Promise<number> {
    try {
      const pattern = `queue:admitted:${eventId}:*`;
      const keys = await redis.keys(pattern);
      return keys.length;
    } catch {
      return 0;
    }
  }

  public async getQueueStatus(eventId: string, sessionId: string): Promise<QueueStatusResult> {
    if (isRedisReady()) {
      try {
        const admittedKey = `queue:admitted:${eventId}:${sessionId}`;
        const isAdmitted = await redis.get(admittedKey);
        if (isAdmitted) {
          const ttl = await redis.ttl(admittedKey);
          const admittedData = JSON.parse(isAdmitted);
          const expiresAt = new Date(admittedData.admittedAt + CHECKOUT_SESSION_TTL * 1000).toISOString();
          return {
            sessionId,
            eventId,
            rank: 0,
            total: 0,
            admitted: true,
            expiresInSeconds: ttl > 0 ? ttl : CHECKOUT_SESSION_TTL,
            checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
            checkoutExpiresAt: expiresAt,
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
          estimatedWaitSeconds: Math.max(MIN_WAIT_SECONDS, (rank + 1) * WAIT_PER_RANK_SECONDS),
          checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
        };
      } catch (err) {
        logger.warn('[Queue] Redis getQueueStatus fallback to in-memory', err);
      }
    }

    // In-memory fallback
    const status = inMemQueue.getStatus(eventId, sessionId);
    let checkoutExpiresAt: string | undefined;
    if (status.admitted && status.admittedAt) {
      checkoutExpiresAt = new Date(status.admittedAt + CHECKOUT_SESSION_TTL * 1000).toISOString();
    }

    return {
      sessionId,
      eventId,
      rank: status.rank,
      total: status.total,
      admitted: status.admitted,
      estimatedWaitSeconds: status.admitted ? undefined : Math.max(status.rank, 0) * WAIT_PER_RANK_SECONDS,
      checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
      checkoutExpiresAt,
    };
  }

  public async isCheckoutSessionValid(eventId: string, sessionId: string): Promise<{ valid: boolean; remainingSeconds: number }> {
    if (isRedisReady()) {
      try {
        const admittedKey = `queue:admitted:${eventId}:${sessionId}`;
        const isAdmitted = await redis.get(admittedKey);
        if (!isAdmitted) {
          return { valid: false, remainingSeconds: 0 };
        }
        const ttl = await redis.ttl(admittedKey);
        return { valid: ttl > 0, remainingSeconds: Math.max(0, ttl) };
      } catch (err) {
        logger.warn('[Queue] Redis session validation fallback', err);
      }
    }

    return inMemQueue.isSessionValid(eventId, sessionId);
  }

  // Keep legacy admitQueue for manual organizer admission
  public async admitQueue(eventId: string, count: number = 50): Promise<number> {
    let admittedCount = 0;

    if (isRedisReady()) {
      try {
        const queueKey = `queue:${eventId}`;
        const sessions = await redis.zrange(queueKey, 0, count - 1);

        if (sessions.length > 0) {
          for (const sess of sessions) {
            const admittedKey = `queue:admitted:${eventId}:${sess}`;
            await redis.setex(admittedKey, CHECKOUT_SESSION_TTL, JSON.stringify({ admittedAt: Date.now() }));
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
