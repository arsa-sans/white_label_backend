import { Request, Response } from 'express';
import crypto from 'crypto';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { io } from '../../server';
import { env } from '../../config/env';

export async function lockSeat(req: Request, res: Response): Promise<void> {
  const { event_id, seat_id } = req.body;
  const userId = req.user?.userId;

  if (!event_id || !seat_id) {
    res.status(400).json(ApiResponse.error('event_id and seat_id are required', 400));
    return;
  }

  const seat = dataStore.seats.find((s) => s.id === seat_id && s.event_id === event_id);
  if (!seat) {
    res.status(404).json(ApiResponse.error('Seat not found', 404));
    return;
  }

  // Check if already sold or locked by another user
  const now = Date.now();
  if (seat.status === 'sold') {
    res.status(409).json(ApiResponse.error('Seat is already sold', 409));
    return;
  }

  if (seat.status === 'locked' && seat.locked_until) {
    if (new Date(seat.locked_until).getTime() > now && seat.locked_by_user_id !== userId) {
      res.status(409).json(ApiResponse.error('Seat is currently locked by another user', 409));
      return;
    }
  }

  // Lock for 5 minutes
  const ttlMs = 5 * 60 * 1000;
  const lockedUntil = new Date(now + ttlMs).toISOString();

  seat.status = 'locked';
  seat.locked_until = lockedUntil;
  seat.locked_by_user_id = userId;

  // Broadcast lock update to event room via Socket.IO
  io.to(`event:${event_id}`).emit('seat_locked', {
    seat_id,
    event_id,
    locked_until: lockedUntil,
  });

  res.json(
    ApiResponse.success(
      {
        seat_id,
        event_id,
        status: 'locked',
        locked_until: lockedUntil,
        expires_in_seconds: 300,
      },
      'Seat locked successfully'
    )
  );
}

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
      location: evt?.location,
      venue_name: evt?.venue_name,
      banner_url: evt?.banner_url,
    };
  });

  res.json(ApiResponse.success(enriched, 'My tickets retrieved'));
}

/**
 * Generate Dynamic QR Token
 * Rotates every 30 seconds based on qr_seed + timestamp window
 */
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

  // 30-second window timestamp
  const nowSec = Math.floor(Date.now() / 1000);
  const timeWindow = Math.floor(nowSec / 30);
  const secondsRemaining = 30 - (nowSec % 30);

  // Create HMAC signature using JWT secret & qr_seed & timeWindow
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET || 'secret');
  hmac.update(`${ticket.id}:${ticket.qr_seed}:${timeWindow}`);
  const signature = hmac.digest('hex').substring(0, 16);

  const payload = {
    tkt: ticket.id,
    evt: ticket.event_id,
    seed: ticket.qr_seed.substring(0, 8),
    w: timeWindow,
    sig: signature,
  };

  const qrToken = Buffer.from(JSON.stringify(payload)).toString('base64');

  res.json(
    ApiResponse.success(
      {
        ticket_id: ticket.id,
        qr_token: qrToken,
        time_window: timeWindow,
        expires_in_seconds: secondsRemaining,
        status: ticket.status,
      },
      'Dynamic QR token generated'
    )
  );
}
