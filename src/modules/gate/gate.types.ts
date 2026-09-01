export interface GateScanResult {
  result: 'valid' | 'invalid' | 'duplicate' | 'expired' | 'offline';
  ticket_id?: string;
  seat_name?: string;
  category?: string;
  event_name?: string;
  tier_name?: string;
  ticket_owner_name?: string;
  ticket_owner_email?: string;
  scanned_at?: string;
  message: string;
  processing_time_ms: number;
}

export interface OfflineScanLog {
  id?: string;
  ticket_id: string;
  gate_device_id?: string;
  scanned_at?: string;
  result: string;
}

export interface SyncGateLogsDto {
  logs: OfflineScanLog[];
}
