import { Request, Response } from 'express';
import crypto from 'crypto';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { env } from '../../config/env';

export async function validateGateScan(req: Request, res: Response): Promise<void> {
  const { qr_token, gate_device_id } = req.body;

  if (!qr_token) {
    res.status(400).json(ApiResponse.error('qr_token is required', 400));
    return;
  }

  try {
    const decodedStr = Buffer.from(qr_token, 'base64').toString('utf-8');
    const payload = JSON.parse(decodedStr);
    const { tkt, w, sig } = payload;

    const ticket = dataStore.tickets.find((t) => t.id === tkt);
    if (!ticket) {
      res.json(ApiResponse.success({ result: 'invalid', message: 'Ticket ID not found in system' }));
      return;
    }

    // Check time window freshness (+/- 1 window tolerance for network clock drift)
    const nowSec = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(nowSec / 30);
    if (Math.abs(currentWindow - w) > 1) {
      res.json(
        ApiResponse.success({
          result: 'expired',
          ticket_id: ticket.id,
          message: 'Dynamic QR token has expired. Request attendee to refresh screen.',
        })
      );
      return;
    }

    // Verify HMAC signature
    const hmac = crypto.createHmac('sha256', env.JWT_SECRET || 'secret');
    hmac.update(`${ticket.id}:${ticket.qr_seed}:${w}`);
    const expectedSig = hmac.digest('hex').substring(0, 16);

    if (sig !== expectedSig) {
      res.json(ApiResponse.success({ result: 'invalid', ticket_id: ticket.id, message: 'Invalid QR signature detected' }));
      return;
    }

    // Check status
    if (ticket.status === 'used') {
      // Record duplicate scan log
      dataStore.gateScanLogs.push({
        id: `scan-${Date.now()}`,
        ticket_id: ticket.id,
        gate_device_id: gate_device_id || 'GATE-WEB-01',
        scanned_at: new Date().toISOString(),
        result: 'duplicate',
      });

      res.json(
        ApiResponse.success({
          result: 'duplicate',
          ticket_id: ticket.id,
          seat_name: ticket.seat_name,
          category: ticket.category,
          message: 'TICKET ALREADY USED FOR ENTRY',
        })
      );
      return;
    }

    if (ticket.status !== 'valid') {
      res.json(
        ApiResponse.success({
          result: 'invalid',
          ticket_id: ticket.id,
          message: `Ticket status is ${ticket.status.toUpperCase()}`,
        })
      );
      return;
    }

    // Success! Mark ticket as used and log scan
    ticket.status = 'used';

    const logEntry = {
      id: `scan-${Date.now()}`,
      ticket_id: ticket.id,
      gate_device_id: gate_device_id || 'GATE-WEB-01',
      scanned_at: new Date().toISOString(),
      result: 'valid' as const,
    };
    dataStore.gateScanLogs.push(logEntry);

    const evt = dataStore.events.find((e) => e.id === ticket.event_id);

    res.json(
      ApiResponse.success(
        {
          result: 'valid',
          ticket_id: ticket.id,
          seat_name: ticket.seat_name,
          category: ticket.category,
          event_name: evt?.name,
          message: 'ENTRY GRANTED - VALID TICKET',
        },
        'Gate scan verification passed'
      )
    );
  } catch (err) {
    res.json(ApiResponse.success({ result: 'invalid', message: 'Malformed QR token' }));
  }
}

export async function syncGateLogs(req: Request, res: Response): Promise<void> {
  const { logs } = req.body;

  if (!Array.isArray(logs)) {
    res.status(400).json(ApiResponse.error('logs array is required', 400));
    return;
  }

  let syncedCount = 0;
  for (const log of logs) {
    dataStore.gateScanLogs.push({
      id: log.id || `sync-${Date.now()}-${Math.random()}`,
      ticket_id: log.ticket_id,
      gate_device_id: log.gate_device_id || 'OFFLINE-DEVICE',
      scanned_at: log.scanned_at || new Date().toISOString(),
      result: log.result || 'valid',
    });
    syncedCount++;
  }

  res.json(ApiResponse.success({ synced_count: syncedCount }, `${syncedCount} gate scan logs synchronized successfully`));
}
