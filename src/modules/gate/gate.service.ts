/**
 * src/modules/gate/gate.service.ts
 *
 * Business logic layer for Gate Validation & Offline Sync.
 */

import crypto from 'crypto';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { logger } from '../../utils/logger';
import { gateRepository } from './gate.repository';
import { GateScanResult, OfflineScanLog } from './gate.types';
import { DemoGateScanLog } from '../../database/dataStore';

const QR_WINDOW_SEC = 30;

function isRedisReady(): boolean {
  return redis.status === 'ready';
}

function deriveHmac(ticketId: string, qrSeed: string, timeWindow: number): string {
  const secret = env.QR_AES_KEY || env.JWT_SECRET || 'dev-secret';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${ticketId}:${qrSeed}:${timeWindow}`);
  return hmac.digest('hex').substring(0, 32);
}

export class GateService {
  /**
   * Validate dynamic QR scan (< 500ms target)
   */
  public async validateGateScan(
    qrToken: string,
    gateDeviceId: string = 'GATE-WEB-01',
    staffEmail?: string
  ): Promise<GateScanResult> {
    const startTime = Date.now();

    try {
      const decodedStr = Buffer.from(qrToken, 'base64url').toString('utf-8');
      const payload = JSON.parse(decodedStr) as { tkt?: string; evt?: string; w?: number; sig?: string };
      const { tkt, w, sig } = payload;

      if (!tkt || w === undefined || !sig) {
        return {
          result: 'invalid',
          message: 'Malformed QR payload format',
          processing_time_ms: Date.now() - startTime,
        };
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const currentWindow = Math.floor(nowSec / QR_WINDOW_SEC);

      if (Math.abs(currentWindow - w) > 1) {
        return {
          result: 'expired',
          ticket_id: tkt,
          message: 'Dynamic QR token has expired. Request visitor to refresh screen.',
          processing_time_ms: Date.now() - startTime,
        };
      }

      let ticket = gateRepository.findTicketById(tkt);
      if (!ticket && isRedisReady()) {
        const cached = await redis.get(`ticket:${tkt}`).catch(() => null);
        if (cached) {
          ticket = JSON.parse(cached);
        }
      }

      if (!ticket) {
        return {
          result: 'invalid',
          message: `Ticket '${tkt}' not found in database`,
          processing_time_ms: Date.now() - startTime,
        };
      }

      const expectedSig = deriveHmac(ticket.id, ticket.qr_seed, w);
      if (sig !== expectedSig && sig !== expectedSig.substring(0, 16)) {
        return {
          result: 'invalid',
          ticket_id: ticket.id,
          message: 'Invalid QR cryptographic signature',
          processing_time_ms: Date.now() - startTime,
        };
      }

      if (ticket.status === 'used') {
        const scanLog: DemoGateScanLog = {
          id: `scan-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
          ticket_id: ticket.id,
          gate_device_id: gateDeviceId,
          scanned_at: new Date().toISOString(),
          result: 'duplicate',
          staff_name: staffEmail || 'Gate Staff',
        };
        gateRepository.appendScanLog(scanLog);

        return {
          result: 'duplicate',
          ticket_id: ticket.id,
          seat_name: ticket.tier_name,
          category: ticket.tier_name,
          message: 'TICKET ALREADY USED FOR ENTRY',
          processing_time_ms: Date.now() - startTime,
        };
      }

      if (ticket.status !== 'valid') {
        return {
          result: 'invalid',
          ticket_id: ticket.id,
          message: `Ticket status is '${ticket.status.toUpperCase()}'`,
          processing_time_ms: Date.now() - startTime,
        };
      }

      ticket.status = 'used';

      const scanLog: DemoGateScanLog = {
        id: `scan-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
        ticket_id: ticket.id,
        gate_device_id: gateDeviceId,
        scanned_at: new Date().toISOString(),
        result: 'valid',
        staff_name: staffEmail || 'Gate Staff',
      };
      gateRepository.appendScanLog(scanLog);

      const event = gateRepository.getEventById(ticket.event_id);

      return {
        result: 'valid',
        ticket_id: ticket.id,
        seat_name: ticket.tier_name,
        category: ticket.tier_name,
        event_name: event?.name || ticket.event_id,
        message: 'ENTRY GRANTED - VALID TICKET',
        processing_time_ms: Date.now() - startTime,
      };
    } catch (err) {
      return {
        result: 'invalid',
        message: 'Malformed or unreadable QR payload string',
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Pre-sync gate dataset for offline validation
   */
  public getPreSyncGateData(eventId: string = 'evt-001') {
    const validTickets = gateRepository
      .getTicketsByEventId(eventId)
      .filter((t) => t.status === 'valid' || t.status === 'used');

    const nowSec = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(nowSec / QR_WINDOW_SEC);

    const items = validTickets.map((t) => {
      const windows = [currentWindow - 1, currentWindow, currentWindow + 1, currentWindow + 2];
      const tokens = windows.map((w) => deriveHmac(t.id, t.qr_seed, w));

      return {
        ticket_id: t.id,
        seat_name: t.tier_name,
        category: t.tier_name,
        status: t.status,
        tokens,
      };
    });

    return {
      event_id: eventId,
      synced_at: new Date().toISOString(),
      total_tickets: items.length,
      current_window: currentWindow,
      tickets: items,
    };
  }

  /**
   * Synchronize offline gate scan logs
   */
  public syncGateLogs(logs: OfflineScanLog[]): { synced_count: number; conflict_count: number } {
    let syncedCount = 0;
    let conflictCount = 0;

    for (const log of logs) {
      const ticket = gateRepository.findTicketById(log.ticket_id);

      if (ticket) {
        if (ticket.status === 'used' && log.result === 'valid') {
          conflictCount++;
          gateRepository.appendScanLog({
            id: log.id || `sync-conflict-${Date.now()}-${Math.random()}`,
            ticket_id: log.ticket_id,
            gate_device_id: log.gate_device_id || 'OFFLINE-DEVICE',
            scanned_at: log.scanned_at || new Date().toISOString(),
            result: 'duplicate',
            staff_name: 'Offline Sync Reconciler',
          });
          continue;
        }
        if (log.result === 'valid') {
          ticket.status = 'used';
        }
      }

      gateRepository.appendScanLog({
        id: log.id || `sync-${Date.now()}-${Math.random()}`,
        ticket_id: log.ticket_id,
        gate_device_id: log.gate_device_id || 'OFFLINE-DEVICE',
        scanned_at: log.scanned_at || new Date().toISOString(),
        result: (log.result as any) || 'valid',
        staff_name: 'Offline Sync Agent',
      });
      syncedCount++;
    }

    logger.info(`[Gate] Synced ${syncedCount} scan log(s) with ${conflictCount} conflict(s)`);
    return { synced_count: syncedCount, conflict_count: conflictCount };
  }

  /**
   * Real-time gate statistics
   */
  public getGateStats(eventId: string = 'evt-001') {
    const eventTickets = gateRepository.getTicketsByEventId(eventId);
    const totalIssued = eventTickets.length;
    const totalCheckedIn = eventTickets.filter((t) => t.status === 'used').length;
    const checkInRate = totalIssued > 0 ? ((totalCheckedIn / totalIssued) * 100).toFixed(1) : '0';

    const scanLogs = gateRepository.getAllScanLogs();
    const validScans = scanLogs.filter((l) => l.result === 'valid').length;
    const duplicateScans = scanLogs.filter((l) => l.result === 'duplicate').length;
    const invalidScans = scanLogs.filter((l) => l.result === 'invalid').length;

    return {
      event_id: eventId,
      total_issued_tickets: totalIssued,
      total_checked_in: totalCheckedIn,
      check_in_percentage: `${checkInRate}%`,
      valid_scans: validScans,
      duplicate_attempts: duplicateScans,
      invalid_scans: invalidScans,
      active_gate_devices: Array.from(new Set(scanLogs.map((l) => l.gate_device_id))),
    };
  }
}

export const gateService = new GateService();
