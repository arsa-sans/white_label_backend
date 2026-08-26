export interface QueueEntry {
  sessionId: string;
  userId: string;
  eventId: string;
  timestamp: number;
  admittedAt?: number;
}

export interface JoinQueueResult {
  sessionId: string;
  eventId: string;
  rank: number;
  admitted: boolean;
  estimatedWaitSeconds?: number;
  expiresInSeconds?: number;
  checkoutTtlSeconds?: number;
  activeCheckouts?: number;
}

export interface QueueStatusResult {
  sessionId: string;
  eventId: string;
  rank: number;
  total: number;
  admitted: boolean;
  estimatedWaitSeconds?: number;
  expiresInSeconds?: number;
  checkoutTtlSeconds?: number;
  checkoutExpiresAt?: string;
}
