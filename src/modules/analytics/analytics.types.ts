export interface DemoPayoutRequest {
  id: string;
  tenant_id: string;
  organizer_id: string;
  event_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  requested_at: string;
  processed_at?: string;
}

export interface RequestPayoutDto {
  event_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
}
