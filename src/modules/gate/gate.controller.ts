/**
 * src/modules/gate/gate.controller.ts
 *
 * FASE 7 — Dynamic QR & Gate Controller
 * Now emits Socket.IO events for real-time notifications on successful scan.
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { gateService } from './gate.service';
import { io } from '../../server';
import { logger } from '../../utils/logger';

export async function validateGateScan(req: Request, res: Response): Promise<void> {
  const { qr_token, gate_device_id = 'GATE-WEB-01' } = req.body;

  if (!qr_token) {
    res.status(400).json(ApiResponse.error('qr_token is required', 400));
    return;
  }

  const result = await gateService.validateGateScan(
    qr_token,
    gate_device_id,
    req.user?.email,
    req.user?.userId,
    req.user?.role
  );

  // Emit real-time Socket.IO notification for all scan results
  try {
    const scanNotification = {
      ...result,
      gate_device_id,
      staff_email: req.user?.email || 'Unknown Staff',
      scanned_at: new Date().toISOString(),
    };

    // Broadcast to all connected clients (gate staff, organizer dashboard, etc.)
    io.emit('gate:scan_result', scanNotification);

    // Also emit to specific event room if ticket has event context
    if (result.ticket_id) {
      io.to(`event:${result.ticket_id}`).emit('gate:scan_result', scanNotification);
    }

    logger.debug(`[Gate] Socket.IO emitted gate:scan_result: ${result.result} for ticket ${result.ticket_id || 'unknown'}`);
  } catch (socketErr) {
    // Socket.IO failure should not break the scan response
    logger.warn('[Gate] Failed to emit Socket.IO event (non-fatal)', socketErr);
  }

  res.json(ApiResponse.success(result));
}

export async function getPreSyncGateData(req: Request, res: Response): Promise<void> {
  const event_id = (req.query.event_id as string) || 'evt-001';
  const data = gateService.getPreSyncGateData(event_id);

  res.json(
    ApiResponse.success(data, 'Offline gate pre-sync dataset retrieved successfully')
  );
}

export async function syncGateLogs(req: Request, res: Response): Promise<void> {
  const { logs } = req.body;

  if (!Array.isArray(logs)) {
    res.status(400).json(ApiResponse.error('logs array is required', 400));
    return;
  }

  const result = gateService.syncGateLogs(logs);

  // Emit sync completion event
  try {
    io.emit('gate:sync_completed', {
      synced_count: result.synced_count,
      conflict_count: result.conflict_count,
      synced_at: new Date().toISOString(),
      staff_email: req.user?.email || 'Unknown',
    });
  } catch (_) {
    // non-fatal
  }

  res.json(
    ApiResponse.success(
      result,
      `${result.synced_count} gate scan logs synchronized (${result.conflict_count} conflict(s) flagged)`
    )
  );
}

export async function getGateStats(req: Request, res: Response): Promise<void> {
  const event_id = (req.query.event_id as string) || 'evt-001';
  const stats = gateService.getGateStats(event_id);

  res.json(ApiResponse.success(stats, 'Gate check-in statistics retrieved'));
}
