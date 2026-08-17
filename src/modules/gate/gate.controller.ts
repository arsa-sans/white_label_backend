/**
 * src/modules/gate/gate.controller.ts
 *
 * FASE 7 — Dynamic QR & Gate Controller
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { gateService } from './gate.service';

export async function validateGateScan(req: Request, res: Response): Promise<void> {
  const { qr_token, gate_device_id = 'GATE-WEB-01' } = req.body;

  if (!qr_token) {
    res.status(400).json(ApiResponse.error('qr_token is required', 400));
    return;
  }

  const result = await gateService.validateGateScan(qr_token, gate_device_id, req.user?.email);
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
