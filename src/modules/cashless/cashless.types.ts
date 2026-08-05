export interface TopupWalletDto {
  amount: number;
  payment_method?: string;
}

export interface PairNfcDto {
  nfc_uid: string;
  target_user_id?: string;
}

export interface DebitBoothDto {
  amount: number;
  nfc_uid?: string;
  user_id?: string;
  reference_id: string;
  booth_name?: string;
  items_summary?: string;
}

export interface RefundBoothTxDto {
  transaction_id: string;
  reason?: string;
}

export interface AutoRefundJobDto {
  event_id?: string;
}
