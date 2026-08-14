/**
 * src/modules/ticket/ticket.controller.ts
 *
 * Phase 4 — Ticket Service (Tier Based)
 *
 * Endpoints:
 *   1. getMyTickets      → list user's purchased tickets with event details
 *   2. getDynamicQrToken → HMAC-SHA256 time-window QR token (30s rotation)
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { env } from '../../config/env';

const QR_WINDOW_SEC = 30;

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/my-tickets
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function getMyTickets(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const userTickets = dataStore.tickets.filter((t) => t.user_id === userId);

  // Enrich with event details
  const enriched = userTickets.map((t) => {
    const evt = dataStore.events.find((e) => e.id === t.event_id);
    return {
      ...t,
      event_name: evt?.name || 'Unknown Event',
      event_date: evt?.start_date,
      event_end_date: evt?.end_date,
      location: evt?.location,
      venue_name: evt?.venue_name,
      banner_url: evt?.banner_url,
      seat_name: t.tier_name, // legacy compatibility
    };
  });

  res.json(ApiResponse.success(enriched, 'My tickets retrieved'));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/:id/qr-token
// Auth: authenticate
// Returns HMAC-signed time-window QR token (30-second rotation)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDynamicQrToken(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.userId;

  const ticket = dataStore.tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json(ApiResponse.error('Ticket not found', 404));
    return;
  }

  if (ticket.user_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'gate_staff') {
    res.status(403).json(ApiResponse.error('Access denied to this ticket QR', 403));
    return;
  }

  if (ticket.status === 'used') {
    res.status(410).json(ApiResponse.error('This ticket has already been used', 410));
    return;
  }

  if (ticket.status === 'void' || ticket.status === 'refunded') {
    res.status(410).json(ApiResponse.error(`Ticket is ${ticket.status} and cannot generate QR`, 410));
    return;
  }

  // ── 30-second time window ──────────────────────────────────────────────
  const nowSec = Math.floor(Date.now() / 1000);
  const timeWindow = Math.floor(nowSec / QR_WINDOW_SEC);
  const secondsRemaining = QR_WINDOW_SEC - (nowSec % QR_WINDOW_SEC);

  // ── HMAC-SHA256 signature ─────────────────────────────────────────────
  const hmac = crypto.createHmac('sha256', env.QR_AES_KEY || env.JWT_SECRET);
  hmac.update(`${ticket.id}:${ticket.qr_seed}:${timeWindow}`);
  const signature = hmac.digest('hex').substring(0, 32);

  const payload = {
    tkt: ticket.id,
    evt: ticket.event_id,
    w: timeWindow,
    sig: signature,
  };

  const qrToken = Buffer.from(JSON.stringify(payload)).toString('base64url');

  res.json(
    ApiResponse.success(
      {
        ticket_id: ticket.id,
        qr_token: qrToken,
        time_window: timeWindow,
        expires_in_seconds: secondsRemaining,
        refresh_at_seconds: Math.max(secondsRemaining - 3, 1),
        status: ticket.status,
      },
      'Dynamic QR token generated'
    )
  );
}

export async function sweepExpiredSeats(): Promise<void> {
  // No-op for tier-based ticketing
}
