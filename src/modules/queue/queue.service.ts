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
const MIN_WAIT_SECONDS = 2;          // Minimum wait when transitioning
const WAIT_PER_RANK_SECONDS = 5;     // Additional seconds per rank position
const CHECKOUT_SESSION_TTL = 180;    // 3 minutes checkout session
const MAX_CONCURRENT_CHECKOUT = 1;   // Strictly 1 user in checkout at a time
const ADMITTED_TTL_MS = CHECKOUT_SESSION_TTL * 1000;

// ─── In-Memory Queue Fallback ────────────────────────────────────────────────
class InMemQueue {
  private queues: Map<string, QueueEntry[]> = new Map();
  private admitted: Map<string, QueueEntry> = new Map();
  private admitTimers: Map<string, NodeJS.Timeout> = new Map();

  public getEstimatedWait(eventId: string, rank: number): number {
    this.cleanupExpiredAdmitted(eventId);
    let currentRemaining = 0;
    for (const adm of this.admitted.values()) {
      if (adm.eventId === eventId && adm.admittedAt) {
        const elapsed = Date.now() - adm.admittedAt;
        const rem = Math.max(0, Math.ceil((ADMITTED_TTL_MS - elapsed) / 1000));
        if (rem > currentRemaining) currentRemaining = rem;
      }
    }
    if (rank <= 0) return 0;
    return currentRemaining + Math.max(0, rank - 1) * CHECKOUT_SESSION_TTL;
  }

  public join(eventId: string, userId: string): { sessionId: string; rank: number; admitted: boolean; estimatedWaitSeconds?: number } {
    this.cleanupExpiredAdmitted(eventId);

    const sessionId = `sess-${userId}-${eventId}`;

    // 1. Check if already admitted and session still valid
    const existingAdmitted = Array.from(this.admitted.values()).find(
      (e) => e.eventId === eventId && e.userId === userId && e.admittedAt! + ADMITTED_TTL_MS > Date.now()
    );
    if (existingAdmitted) {
      return { sessionId: existingAdmitted.sessionId, rank: 0, admitted: true, estimatedWaitSeconds: 0 };
    }

    let list = this.queues.get(eventId) || [];

    // 2. Check if already in queue
    const existingIndex = list.findIndex((e) => e.userId === userId);
    if (existingIndex >= 0) {
      const rank = existingIndex + 1;
      const waitSeconds = this.getEstimatedWait(eventId, rank);
      return { sessionId: list[existingIndex].sessionId, rank, admitted: false, estimatedWaitSeconds: waitSeconds };
    }

    const activeCount = this.getActiveCheckoutCount(eventId);

    // 3. If slot is free and nobody is waiting ahead, admit IMMEDIATELY!
    if (activeCount < MAX_CONCURRENT_CHECKOUT && list.length === 0) {
      const entry: QueueEntry = { sessionId, userId, eventId, timestamp: Date.now(), admittedAt: Date.now() };
      this.admitted.set(sessionId, entry);
      logger.info(`[Queue] User ${userId} immediately admitted for event ${eventId} (slot free)`);
      return { sessionId, rank: 0, admitted: true, estimatedWaitSeconds: 0 };
    }

    // 4. Otherwise, add to waiting queue
    const entry: QueueEntry = { sessionId, userId, eventId, timestamp: Date.now() };
    list.push(entry);
    this.queues.set(eventId, list);

    const rank = list.length;
    const waitSeconds = this.getEstimatedWait(eventId, rank);

    // Schedule auto-admit retry loop
    this.scheduleAutoAdmit(eventId, sessionId, userId, 2);

    return { sessionId, rank, admitted: false, estimatedWaitSeconds: waitSeconds };
  }

  public release(eventId: string, userIdOrSessionId: string): void {
    for (const [key, entry] of this.admitted.entries()) {
      if (entry.eventId === eventId && (entry.sessionId === userIdOrSessionId || entry.userId === userIdOrSessionId)) {
        this.admitted.delete(key);
        logger.info(`[Queue] Released checkout session ${key} for user ${entry.userId}`);
      }
    }

    const list = this.queues.get(eventId) || [];
    const filtered = list.filter((e) => e.userId !== userIdOrSessionId && e.sessionId !== userIdOrSessionId);
    this.queues.set(eventId, filtered);

    // Immediately try admitting next user
    this.tryAutoAdmitNext(eventId);
  }

  public tryAutoAdmitNext(eventId: string): void {
    this.cleanupExpiredAdmitted(eventId);
    const activeCount = this.getActiveCheckoutCount(eventId);
    if (activeCount >= MAX_CONCURRENT_CHECKOUT) {
      return;
    }

    const list = this.queues.get(eventId) || [];
    if (list.length === 0) return;

    const nextEntry = list.shift();
    if (!nextEntry) return;

    nextEntry.admittedAt = Date.now();
    this.admitted.set(nextEntry.sessionId, nextEntry);
    this.queues.set(eventId, list);

    const timerKey = `${eventId}:${nextEntry.sessionId}`;
    const existingTimer = this.admitTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.admitTimers.delete(timerKey);
    }

    io.to(`event:${eventId}`).emit('queue_admitted', {
      event_id: eventId,
      session_id: nextEntry.sessionId,
      user_id: nextEntry.userId,
      checkout_ttl_seconds: CHECKOUT_SESSION_TTL,
      timestamp: new Date().toISOString(),
    });

    logger.info(`[Queue] Auto-admitted next user in queue: ${nextEntry.userId} for event ${eventId}`);
  }

  private scheduleAutoAdmit(eventId: string, sessionId: string, userId: string, delaySec: number): void {
    const timerKey = `${eventId}:${sessionId}`;
    const existingTimer = this.admitTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.tryAutoAdmit(eventId, sessionId, userId);
    }, delaySec * 1000);

    this.admitTimers.set(timerKey, timer);
  }

  private tryAutoAdmit(eventId: string, sessionId: string, userId: string): void {
    this.cleanupExpiredAdmitted(eventId);
    const activeCount = this.getActiveCheckoutCount(eventId);

    const list = this.queues.get(eventId) || [];
    const entryIndex = list.findIndex((e) => e.sessionId === sessionId);
    if (entryIndex === -1) return; // already handled

    if (activeCount < MAX_CONCURRENT_CHECKOUT && entryIndex === 0) {
      this.tryAutoAdmitNext(eventId);
      return;
    }

    this.scheduleAutoAdmit(eventId, sessionId, userId, 1.5);
  }

  private cleanupExpiredAdmitted(eventId?: string): void {
    const now = Date.now();
    let hadExpired = false;
    for (const [key, entry] of this.admitted.entries()) {
      if (entry.admittedAt && entry.admittedAt + ADMITTED_TTL_MS <= now) {
        this.admitted.delete(key);
        hadExpired = true;
        logger.info(`[Queue] Expired checkout session ${key} cleaned up`);
      }
    }
    if (hadExpired && eventId) {
      this.tryAutoAdmitNext(eventId);
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

  public getStatus(eventId: string, sessionId: string): { rank: number; total: number; admitted: boolean; admittedAt?: number; estimatedWaitSeconds?: number } {
    this.cleanupExpiredAdmitted(eventId);
    const adm = this.admitted.get(sessionId);
    if (adm && adm.admittedAt! + ADMITTED_TTL_MS > Date.now()) {
      return { rank: 0, total: 0, admitted: true, admittedAt: adm.admittedAt, estimatedWaitSeconds: 0 };
    }

    const list = this.queues.get(eventId) || [];
    const index = list.findIndex((e) => e.sessionId === sessionId);
    if (index === -1) {
      return { rank: -1, total: list.length, admitted: false, estimatedWaitSeconds: 0 };
    }

    const rank = index + 1;
    const estimatedWaitSeconds = this.getEstimatedWait(eventId, rank);
    return { rank, total: list.length, admitted: false, estimatedWaitSeconds };
  }

  public isSessionValid(eventId: string, sessionId: string): { valid: boolean; remainingSeconds: number } {
    this.cleanupExpiredAdmitted(eventId);
    const adm = this.admitted.get(sessionId);
    if (!adm || !adm.admittedAt) {
      return { valid: false, remainingSeconds: 0 };
    }

    const elapsed = Date.now() - adm.admittedAt;
    const remaining = ADMITTED_TTL_MS - elapsed;

    if (remaining <= 0) {
      this.admitted.delete(sessionId);
      this.tryAutoAdmitNext(eventId);
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
    const event = dataStore.events.find((e) => e.id === eventId);
    if (event) {
      const now = new Date();
      if (event.sale_start_at && now < new Date(event.sale_start_at)) {
        const err: any = new Error('Penjualan tiket belum dimulai');
        err.statusCode = 400;
        throw err;
      }
      if (event.sale_end_at && now > new Date(event.sale_end_at)) {
        const err: any = new Error('Penjualan tiket sudah ditutup');
        err.statusCode = 400;
        throw err;
      }
    }

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
        const activeCheckouts = await this.getActiveCheckoutCountRedis(eventId);
        const totalInQueue = await redis.zcard(queueKey);

        // If slot is free and queue is empty, admit immediately!
        if (activeCheckouts < MAX_CONCURRENT_CHECKOUT && totalInQueue === 0) {
          await redis.setex(admittedKey, CHECKOUT_SESSION_TTL, JSON.stringify({ userId, admittedAt: Date.now() }));
          logger.info(`[Queue] Redis immediately admitted user ${userId} for event ${eventId} (slot free)`);
          return {
            sessionId,
            eventId,
            rank: 0,
            admitted: true,
            expiresInSeconds: CHECKOUT_SESSION_TTL,
            checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
            activeCheckouts: 1,
          };
        }

        await redis.zadd(queueKey, timestamp, sessionId);
        const rank = (await redis.zrank(queueKey, sessionId)) ?? 0;

        // Calculate realistic wait time
        const waitSeconds = inMemQueue.getEstimatedWait(eventId, rank + 1);

        // Schedule auto-admit retry
        this.scheduleRedisAutoAdmit(eventId, sessionId, userId, 2);

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

    return {
      sessionId: resData.sessionId,
      eventId,
      rank: resData.rank,
      admitted: resData.admitted,
      estimatedWaitSeconds: resData.admitted ? undefined : (resData.estimatedWaitSeconds ?? 5),
      checkoutTtlSeconds: CHECKOUT_SESSION_TTL,
      activeCheckouts,
    };
  }

  public async releaseCheckoutSession(eventId: string, userIdOrSessionId: string): Promise<void> {
    if (isRedisReady()) {
      try {
        const pattern = `queue:admitted:${eventId}:*`;
        const keys = await redis.keys(pattern);
        for (const key of keys) {
          const val = await redis.get(key);
          if (val) {
            try {
              const data = JSON.parse(val);
              if (data.userId === userIdOrSessionId || key.includes(userIdOrSessionId)) {
                await redis.del(key);
                logger.info(`[Queue] Redis checkout session ${key} released`);
              }
            } catch {}
          }
        }
        const queueKey = `queue:${eventId}`;
        const sessionId = `sess-${userIdOrSessionId}-${eventId}`;
        await redis.zrem(queueKey, sessionId);
        await redis.zrem(queueKey, userIdOrSessionId);

        // Immediately try auto-admitting next user in Redis
        const nextSessions = await redis.zrange(queueKey, 0, 0);
        if (nextSessions.length > 0) {
          const nextSession = nextSessions[0];
          const activeCount = await this.getActiveCheckoutCountRedis(eventId);
          if (activeCount < MAX_CONCURRENT_CHECKOUT) {
            await redis.zrem(queueKey, nextSession);
            const nextAdmittedKey = `queue:admitted:${eventId}:${nextSession}`;
            await redis.setex(nextAdmittedKey, CHECKOUT_SESSION_TTL, JSON.stringify({ admittedAt: Date.now() }));
            io.to(`event:${eventId}`).emit('queue_admitted', {
              event_id: eventId,
              session_id: nextSession,
              checkout_ttl_seconds: CHECKOUT_SESSION_TTL,
              timestamp: new Date().toISOString(),
            });
            logger.info(`[Queue] Redis auto-admitted next user: ${nextSession}`);
          }
        }
      } catch (err) {
        logger.warn('[Queue] Redis release error', err);
      }
    }

    inMemQueue.release(eventId, userIdOrSessionId);
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
