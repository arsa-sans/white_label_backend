import { DemoTicket } from '../../database/dataStore';

export interface LockSeatDto {
  event_id: string;
  seat_id: string;
}

export interface ReleaseSeatDto {
  event_id: string;
  seat_id: string;
}

export interface EnrichedTicket extends DemoTicket {
  event_name?: string;
  event_date?: string;
  event_end_date?: string;
  location?: string;
  venue_name?: string;
  banner_url?: string;
  seat_name?: string;
}

export interface QrTokenResult {
  ticket_id: string;
  qr_token: string;
  time_window: number;
  expires_in_seconds: number;
  refresh_at_seconds: number;
  status: string;
}
