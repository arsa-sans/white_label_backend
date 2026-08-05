export interface LockSeatDto {
  event_id: string;
  seat_id: string;
}

export interface ReleaseSeatDto {
  event_id: string;
  seat_id: string;
}

export interface EnrichedTicket {
  id: string;
  event_id: string;
  seat_id: string;
  user_id: string;
  order_id: string;
  qr_seed: string;
  seat_name: string;
  category: string;
  price: number;
  status: 'valid' | 'used' | 'void' | 'refunded';
  issued_at: string;
  event_name?: string;
  event_date?: string;
  event_end_date?: string;
  location?: string;
  venue_name?: string;
  banner_url?: string;
}

export interface QrTokenResult {
  ticket_id: string;
  qr_token: string;
  time_window: number;
  expires_in_seconds: number;
  refresh_at_seconds: number;
  status: string;
}
