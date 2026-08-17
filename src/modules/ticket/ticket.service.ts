/**
 * src/modules/ticket/ticket.service.ts
 *
 * Business logic layer for Ticket management & Dynamic QR Token generation.
 */

import crypto from 'crypto';
import { env } from '../../config/env';
import { ticketRepository } from './ticket.repository';
import { EnrichedTicket, QrTokenResult } from './ticket.types';

const QR_WINDOW_SEC = 30;

export class TicketService {
  /**
   * Get user's purchased tickets enriched with event details
   */
  public getMyTickets(userId: string): EnrichedTicket[] {
    const userTickets = ticketRepository.getTicketsByUser(userId);

    return userTickets.map((t) => {
      const evt = ticketRepository.getEventById(t.event_id);
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
  }

  /**
   * Generate HMAC-signed time-window QR token (30-second rotation)
   */
  public getDynamicQrToken(
    ticketId: string,
    userId: string,
    role?: string
  ): { status: number; message?: string; data?: QrTokenResult } {
    const ticket = ticketRepository.findTicketById(ticketId);
    if (!ticket) {
      return { status: 404, message: 'Ticket not found' };
    }

    if (ticket.user_id !== userId && role !== 'admin' && role !== 'gate_staff') {
      return { status: 403, message: 'Access denied to this ticket QR' };
    }

    if (ticket.status === 'used') {
      return { status: 410, message: 'This ticket has already been used' };
    }

    if (ticket.status === 'void' || ticket.status === 'refunded') {
      return { status: 410, message: `Ticket is ${ticket.status} and cannot generate QR` };
    }

    // 30-second time window
    const nowSec = Math.floor(Date.now() / 1000);
    const timeWindow = Math.floor(nowSec / QR_WINDOW_SEC);
    const secondsRemaining = QR_WINDOW_SEC - (nowSec % QR_WINDOW_SEC);

    // HMAC-SHA256 signature
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

    return {
      status: 200,
      data: {
        ticket_id: ticket.id,
        qr_token: qrToken,
        time_window: timeWindow,
        expires_in_seconds: secondsRemaining,
        refresh_at_seconds: Math.max(secondsRemaining - 3, 1),
        status: ticket.status,
      },
    };
  }

  public async sweepExpiredSeats(): Promise<void> {
    // No-op for tier-based ticketing
  }
}

export const ticketService = new TicketService();
