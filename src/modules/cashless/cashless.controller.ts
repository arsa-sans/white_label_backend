import { Request, Response } from 'express';
import { dataStore, DemoWallet } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';

export async function getWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;

  let wallet = dataStore.wallets.get(userId!);
  if (!wallet) {
    // Auto-create wallet if missing
    wallet = {
      id: `wlt-${Date.now()}`,
      user_id: userId!,
      event_id: 'evt-001',
      balance: 0,
      nfc_uid: `NFC-${Math.floor(Math.random() * 899999 + 100000)}`,
    };
    dataStore.wallets.set(userId!, wallet);
  }

  const txs = dataStore.walletTxs.filter((t) => t.wallet_id === wallet!.id);

  res.json(
    ApiResponse.success(
      {
        wallet,
        transactions: txs,
      },
      'Wallet details retrieved'
    )
  );
}

export async function topupWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { amount } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json(ApiResponse.error('Valid positive top-up amount is required', 400));
    return;
  }

  let wallet = dataStore.wallets.get(userId!);
  if (!wallet) {
    wallet = {
      id: `wlt-${Date.now()}`,
      user_id: userId!,
      event_id: 'evt-001',
      balance: 0,
      nfc_uid: `NFC-${Math.floor(Math.random() * 899999 + 100000)}`,
    };
    dataStore.wallets.set(userId!, wallet);
  }

  wallet.balance += amount;

  const tx = {
    id: `tx-${Date.now()}`,
    wallet_id: wallet.id,
    amount,
    type: 'topup' as const,
    description: `Top-up via QRIS Instant`,
    created_at: new Date().toISOString(),
  };

  dataStore.walletTxs.unshift(tx);

  res.json(
    ApiResponse.success(
      {
        wallet,
        transaction: tx,
      },
      `Successfully topped up Rp ${amount.toLocaleString('id-ID')}`
    )
  );
}
