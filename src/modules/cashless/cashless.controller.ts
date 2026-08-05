/**
 * src/modules/cashless/cashless.controller.ts
 *
 * FASE 8 — Cashless Service
 *
 * Implementasi mengikuti SKILLS.md § Skill 6 (Cashless Wallet Transaction Safety):
 *   1. getWallet       → GET /cashless/wallet (saldo, NFC UID, history)
 *   2. topupWallet     → POST /cashless/wallet/topup (top-up saldo)
 *   3. pairNfc         → POST /cashless/wallet/pair-nfc (pair wristband NFC UID ↔ user wallet)
 *   4. debitBooth      → POST /cashless/booth/debit (transaksi booth kasir dengan idempotency reference_id & row lock)
 *   5. refundBoothTx   → POST /cashless/booth/refund (refund transaksi booth tertentu)
 *   6. autoRefundJob   → POST /cashless/wallet/auto-refund (refund otomatis sisa saldo post-event)
 *   7. getBoothHistory → GET /cashless/booth/history (riwayat transaksi booth vendor)
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { dataStore, DemoWallet, DemoWalletTx } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { publishEvent } from '../../queue/publisher';
import { logger } from '../../utils/logger';

// Helper: Get or create wallet
function getOrCreateWallet(userId: string, eventId = 'evt-001'): DemoWallet {
  let wallet = dataStore.wallets.get(userId);
  if (!wallet) {
    wallet = {
      id: `wlt-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
      user_id: userId,
      event_id: eventId,
      balance: 0,
      nfc_uid: `NFC-${Math.floor(Math.random() * 899999 + 100000)}`,
    };
    dataStore.wallets.set(userId, wallet);
  }
  return wallet;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /cashless/wallet
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function getWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(ApiResponse.error('Authentication required', 401));
    return;
  }

  const wallet = getOrCreateWallet(userId);
  const txs = dataStore.walletTxs.filter((t) => t.wallet_id === wallet.id);

  res.json(
    ApiResponse.success(
      {
        wallet,
        transactions: txs,
      },
      'Wallet details retrieved successfully'
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /cashless/wallet/topup
// Body: { amount, payment_method? }
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function topupWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { amount, payment_method = 'QRIS Instant' } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json(ApiResponse.error('Valid positive top-up amount is required', 400));
    return;
  }

  const wallet = getOrCreateWallet(userId!);
  wallet.balance += amount;

  const tx: DemoWalletTx = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
    wallet_id: wallet.id,
    amount,
    type: 'topup',
    description: `Top-up via ${payment_method}`,
    created_at: new Date().toISOString(),
  };

  dataStore.walletTxs.unshift(tx);

  // Publish wallet.topup event to RabbitMQ
  publishEvent(
    'wallet.topup',
    {
      wallet_id: wallet.id,
      user_id: userId,
      amount,
      new_balance: wallet.balance,
      transaction_id: tx.id,
    },
    req.user?.tenantId || 'tenant-001'
  ).catch((err) => logger.warn('[Cashless] Failed to publish wallet.topup event', err));

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /cashless/wallet/pair-nfc
// Body: { nfc_uid, user_id? }
// Auth: authenticate (gate_staff / vendor / self)
// ─────────────────────────────────────────────────────────────────────────────
export async function pairNfc(req: Request, res: Response): Promise<void> {
  const { nfc_uid, target_user_id } = req.body;
  const userId = target_user_id || req.user?.userId;

  if (!nfc_uid || typeof nfc_uid !== 'string' || nfc_uid.trim() === '') {
    res.status(400).json(ApiResponse.error('Valid nfc_uid string is required', 400));
    return;
  }

  const cleanUid = nfc_uid.trim().toUpperCase();

  // Check if NFC UID is already paired to another active wallet
  for (const [wUserId, existingWallet] of Array.from(dataStore.wallets.entries())) {
    if (existingWallet.nfc_uid === cleanUid && wUserId !== userId) {
      res.status(409).json(
        ApiResponse.error(`NFC UID '${cleanUid}' is already paired to another attendee wallet`, 409)
      );
      return;
    }
  }

  const wallet = getOrCreateWallet(userId!);
  wallet.nfc_uid = cleanUid;

  logger.info(`[Cashless] Paired NFC UID ${cleanUid} to user ${userId}`);

  res.json(
    ApiResponse.success(
      {
        wallet,
        paired_nfc_uid: cleanUid,
      },
      `NFC Wristband '${cleanUid}' successfully paired to wallet`
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /cashless/booth/debit
// Body: { amount, nfc_uid?, user_id?, reference_id, booth_name?, items_summary? }
// Auth: authenticate (role: vendor, admin, organizer)
// SKILLS.md § Skill 6: Atomic transaction + Idempotency via reference_id
// ─────────────────────────────────────────────────────────────────────────────
export async function debitBooth(req: Request, res: Response): Promise<void> {
  const { amount, nfc_uid, user_id, reference_id, booth_name = 'F&B Booth #1', items_summary } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json(ApiResponse.error('Valid positive transaction amount is required', 400));
    return;
  }

  if (!reference_id || typeof reference_id !== 'string') {
    res.status(400).json(
      ApiResponse.error('Idempotency reference_id (UUID v4) is required per booth tap', 400)
    );
    return;
  }

  // Check idempotency: if reference_id seen before, return cached transaction
  const existingTx = dataStore.walletTxs.find((t) => t.id === reference_id || t.description.includes(reference_id));
  if (existingTx) {
    const existingWallet = Array.from(dataStore.wallets.values()).find((w) => w.id === existingTx.wallet_id);
    res.json(
      ApiResponse.success(
        {
          wallet: existingWallet,
          transaction: existingTx,
          idempotent_response: true,
        },
        'Transaction already processed (Idempotent response)'
      )
    );
    return;
  }

  // Find wallet by NFC UID or user_id
  let targetWallet: DemoWallet | undefined;

  if (nfc_uid) {
    const cleanUid = nfc_uid.trim().toUpperCase();
    targetWallet = Array.from(dataStore.wallets.values()).find((w) => w.nfc_uid === cleanUid);
  } else if (user_id) {
    targetWallet = dataStore.wallets.get(user_id);
  } else {
    // Fallback: use logged-in user's wallet
    targetWallet = dataStore.wallets.get(req.user?.userId!);
  }

  if (!targetWallet) {
    res.status(404).json(
      ApiResponse.error(`Wallet not found for ${nfc_uid ? `NFC '${nfc_uid}'` : 'user'}`, 404)
    );
    return;
  }

  // Row lock simulation & Balance check (SKILLS.md § Skill 6)
  if (targetWallet.balance < amount) {
    res.status(402).json(
      ApiResponse.error(
        `Insufficient balance. Saldo: Rp ${targetWallet.balance.toLocaleString('id-ID')}, Dibutuhkan: Rp ${amount.toLocaleString('id-ID')}`,
        402
      )
    );
    return;
  }

  // Debit balance atomically
  targetWallet.balance -= amount;

  const tx: DemoWalletTx = {
    id: reference_id,
    wallet_id: targetWallet.id,
    amount,
    type: 'payment',
    description: `Payment at ${booth_name}${items_summary ? ` (${items_summary})` : ''} [Ref: ${reference_id}]`,
    created_at: new Date().toISOString(),
  };

  dataStore.walletTxs.unshift(tx);

  logger.info(
    `[Cashless] Booth debit success — ${booth_name}: Rp ${amount} debited from wallet ${targetWallet.id} (ref=${reference_id})`
  );

  res.json(
    ApiResponse.success(
      {
        wallet: targetWallet,
        transaction: tx,
        remaining_balance: targetWallet.balance,
      },
      `Transaction successful. Saldo sisa: Rp ${targetWallet.balance.toLocaleString('id-ID')}`
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /cashless/booth/refund
// Body: { transaction_id, reason? }
// Auth: authenticate (role: vendor, admin, organizer)
// ─────────────────────────────────────────────────────────────────────────────
export async function refundBoothTx(req: Request, res: Response): Promise<void> {
  const { transaction_id, reason = 'Customer refund request' } = req.body;

  if (!transaction_id) {
    res.status(400).json(ApiResponse.error('transaction_id is required', 400));
    return;
  }

  const txIndex = dataStore.walletTxs.findIndex((t) => t.id === transaction_id);
  if (txIndex === -1) {
    res.status(404).json(ApiResponse.error('Transaction not found', 404));
    return;
  }

  const origTx = dataStore.walletTxs[txIndex];
  if (origTx.type !== 'payment') {
    res.status(400).json(ApiResponse.error(`Only 'payment' transactions can be refunded (type is '${origTx.type}')`, 400));
    return;
  }

  const wallet = Array.from(dataStore.wallets.values()).find((w) => w.id === origTx.wallet_id);
  if (!wallet) {
    res.status(404).json(ApiResponse.error('Associated wallet not found', 404));
    return;
  }

  // Credit balance back
  wallet.balance += origTx.amount;

  const refundTx: DemoWalletTx = {
    id: `ref-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
    wallet_id: wallet.id,
    amount: origTx.amount,
    type: 'refund',
    description: `Refund for Tx #${origTx.id}: ${reason}`,
    created_at: new Date().toISOString(),
  };

  dataStore.walletTxs.unshift(refundTx);

  res.json(
    ApiResponse.success(
      {
        wallet,
        refund_transaction: refundTx,
      },
      `Refund of Rp ${origTx.amount.toLocaleString('id-ID')} processed successfully`
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /cashless/wallet/auto-refund
// Body: { event_id }
// Auth: authenticate (role: admin, organizer)
// SKILLS.md § Skill 6: Scheduled job refund sisa saldo post-event
// ─────────────────────────────────────────────────────────────────────────────
export async function autoRefundJob(req: Request, res: Response): Promise<void> {
  const { event_id = 'evt-001' } = req.body;

  let refundedCount = 0;
  let totalRefundedAmount = 0;

  for (const [, wallet] of Array.from(dataStore.wallets.entries())) {
    if (wallet.event_id === event_id && wallet.balance > 0) {
      const amountToRefund = wallet.balance;
      wallet.balance = 0;

      const refundTx: DemoWalletTx = {
        id: `auto-ref-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
        wallet_id: wallet.id,
        amount: amountToRefund,
        type: 'refund',
        description: `Automated post-event remaining balance refund`,
        created_at: new Date().toISOString(),
      };

      dataStore.walletTxs.unshift(refundTx);
      refundedCount++;
      totalRefundedAmount += amountToRefund;

      // Publish refund.processed event to RabbitMQ
      publishEvent(
        'refund.processed',
        {
          wallet_id: wallet.id,
          user_id: wallet.user_id,
          amount: amountToRefund,
          event_id,
        },
        req.user?.tenantId || 'tenant-001'
      ).catch(() => {});
    }
  }

  logger.info(`[Cashless] Auto-refund job completed: ${refundedCount} wallet(s) refunded, total Rp ${totalRefundedAmount}`);

  res.json(
    ApiResponse.success(
      {
        event_id,
        wallets_refunded: refundedCount,
        total_refunded_amount: totalRefundedAmount,
      },
      `Auto-refund job executed: ${refundedCount} wallet(s) refunded (Total Rp ${totalRefundedAmount.toLocaleString('id-ID')})`
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /cashless/booth/history
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
export async function getBoothHistory(req: Request, res: Response): Promise<void> {
  const txs = dataStore.walletTxs.filter((t) => t.type === 'payment' || t.type === 'refund');
  res.json(ApiResponse.success(txs, 'Booth transaction history retrieved'));
}
