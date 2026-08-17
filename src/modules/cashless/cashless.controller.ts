/**
 * src/modules/cashless/cashless.controller.ts
 *
 * FASE 8 — Cashless Controller
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/apiResponse';
import { cashlessService } from './cashless.service';

export async function getWallet(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(ApiResponse.error('Authentication required', 401));
    return;
  }

  const result = cashlessService.getWalletDetails(userId);
  res.json(ApiResponse.success(result, 'Wallet details retrieved successfully'));
}

export async function getPaymentMethods(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(ApiResponse.error('Authentication required', 401));
    return;
  }

  const methods = cashlessService.getPaymentMethods(userId);
  res.json(ApiResponse.success(methods, 'Payment methods retrieved'));
}

export async function addPaymentMethod(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { type, account_number, account_name } = req.body;

  if (!type || !account_number || !account_name) {
    res.status(400).json(ApiResponse.error('type, account_number, dan account_name wajib diisi', 400));
    return;
  }

  if (!userId) {
    res.status(401).json(ApiResponse.error('Authentication required', 401));
    return;
  }

  const result = cashlessService.addPaymentMethod(userId, { type, account_number, account_name });
  if (result.status !== 201) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error adding payment method', result.status));
    return;
  }

  res.status(201).json(ApiResponse.success(result.data, 'Metode pembayaran e-wallet berhasil ditambahkan'));
}

export async function deletePaymentMethod(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const methodId = req.params.id as string;

  if (!userId) {
    res.status(401).json(ApiResponse.error('Authentication required', 401));
    return;
  }

  const result = cashlessService.deletePaymentMethod(userId, methodId);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error deleting payment method', result.status));
    return;
  }

  res.json(ApiResponse.success({ id: methodId }, 'Metode pembayaran berhasil dihapus'));
}

export async function topupWallet(_req: Request, res: Response): Promise<void> {
  res.status(400).json(
    ApiResponse.error(
      'Fitur wallet top-up untuk Visitor telah dinonaktifkan. Gunakan metode pembayaran e-wallet langsung saat checkout.',
      400
    )
  );
}

export async function pairNfc(req: Request, res: Response): Promise<void> {
  const { nfc_uid, target_user_id } = req.body;
  const userId = target_user_id || req.user?.userId;

  if (!nfc_uid || typeof nfc_uid !== 'string' || nfc_uid.trim() === '') {
    res.status(400).json(ApiResponse.error('Valid nfc_uid string is required', 400));
    return;
  }

  if (!userId) {
    res.status(401).json(ApiResponse.error('User identification required', 401));
    return;
  }

  const result = cashlessService.pairNfc(userId, nfc_uid);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error pairing NFC', result.status));
    return;
  }

  res.json(ApiResponse.success(result.data, `NFC Wristband '${nfc_uid.trim().toUpperCase()}' successfully paired to wallet`));
}

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

  const result = cashlessService.debitBooth(
    { amount, nfc_uid, user_id, reference_id, booth_name, items_summary },
    req.user?.userId
  );

  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error processing transaction', result.status));
    return;
  }

  res.json(
    ApiResponse.success(
      result.data,
      result.message || `Transaction successful. Saldo sisa: Rp ${result.data?.remaining_balance?.toLocaleString('id-ID')}`
    )
  );
}

export async function refundBoothTx(req: Request, res: Response): Promise<void> {
  const { transaction_id, reason = 'Customer refund request' } = req.body;

  if (!transaction_id) {
    res.status(400).json(ApiResponse.error('transaction_id is required', 400));
    return;
  }

  const result = cashlessService.refundBoothTx(transaction_id, reason);
  if (result.status !== 200) {
    res.status(result.status).json(ApiResponse.error(result.message || 'Error processing refund', result.status));
    return;
  }

  res.json(
    ApiResponse.success(
      result.data,
      `Refund of Rp ${result.data?.refund_transaction?.amount?.toLocaleString('id-ID')} processed successfully`
    )
  );
}

export async function autoRefundJob(req: Request, res: Response): Promise<void> {
  const { event_id = 'evt-001' } = req.body;
  const result = cashlessService.autoRefundJob(event_id, req.user?.tenantId || 'tenant-001');

  res.json(
    ApiResponse.success(
      {
        event_id,
        wallets_refunded: result.wallets_refunded,
        total_refunded_amount: result.total_refunded_amount,
      },
      `Auto-refund job executed: ${result.wallets_refunded} wallet(s) refunded (Total Rp ${result.total_refunded_amount.toLocaleString('id-ID')})`
    )
  );
}

export async function getBoothHistory(_req: Request, res: Response): Promise<void> {
  const txs = cashlessService.getBoothHistory();
  res.json(ApiResponse.success(txs, 'Booth transaction history retrieved'));
}
