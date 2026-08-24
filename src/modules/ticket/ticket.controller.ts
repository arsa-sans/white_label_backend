/**
 * src/modules/ticket/ticket.controller.ts
 *
 * Phase 4 — Ticket Controller (Tier Based)
 * Endpoints:
 *   1. getMyTickets      → list user's purchased tickets with event details
 *   2. getDynamicQrToken → HMAC-SHA256 time-window QR token (30s rotation)
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { ticketService } from './ticket.service';

export async function getMyTickets(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(ApiResponse.error('Unauthorized', 401));
    return;
  }

  const enriched = ticketService.getMyTickets(userId);
  res.json(ApiResponse.success(enriched, 'My tickets retrieved'));
}

export async function getDynamicQrToken(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(ApiResponse.error('Unauthorized', 401));
    return;
  }

  const role = typeof req.user?.role === 'string' ? req.user.role : undefined;
  const result = ticketService.getDynamicQrToken(id, userId, role);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error generating QR token', result.status));
    return;
  }

  res.json(ApiResponse.success(result.data, 'Dynamic QR token generated'));
}

import { generateTicketPdf } from './ticket-pdf.service';

export async function downloadTicketPdf(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user?.userId;
  const tenantId = req.tenantId || (req.user as any)?.tenant_id || 'tenant-001';

  if (!userId) {
    res.status(401).json(ApiResponse.error('Unauthorized', 401));
    return;
  }

  try {
    const pdfBuffer = await generateTicketPdf(id, tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(404).json(ApiResponse.error(error.message || 'Gagal membuat file PDF tiket', 404));
  }
}

export async function sweepExpiredSeats(): Promise<void> {
  await ticketService.sweepExpiredSeats();
}
