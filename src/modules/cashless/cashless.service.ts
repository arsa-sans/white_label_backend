/**
 * src/modules/cashless/cashless.service.ts
 *
 * Business logic layer for Cashless Wallets, NFC pairing, and Booth debit/refund.
 */

import { dataStore, DemoWallet, DemoWalletTx } from '../../database/dataStore';
import { cashlessRepository } from './cashless.repository';
import { publishEvent } from '../../queue/publisher';
import { logger } from '../../utils/logger';
import { DebitBoothDto } from './cashless.types';

export class CashlessService {
  /**
   * Get or create attendee wallet
   */
  public getOrCreateWallet(userId: string, eventId = 'evt-001'): DemoWallet {
    let wallet = cashlessRepository.getWalletByUserId(userId);
    if (!wallet) {
      wallet = {
        id: `wlt-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
        user_id: userId,
        event_id: eventId,
        balance: 0,
        nfc_uid: `NFC-${Math.floor(Math.random() * 899999 + 100000)}`,
      };
      cashlessRepository.saveWallet(userId, wallet);
    }
    return wallet;
  }

  public getWalletDetails(userId: string) {
    const wallet = this.getOrCreateWallet(userId);
    const transactions = cashlessRepository.getTransactionsByWalletId(wallet.id);
    return { wallet, transactions };
  }

  public getPaymentMethods(userId: string) {
    return dataStore.paymentMethods.filter((pm) => pm.user_id === userId);
  }

  public addPaymentMethod(
    userId: string,
    data: { type: string; account_number: string; account_name: string }
  ): { status: number; message?: string; data?: any } {
    const { type, account_number, account_name } = data;

    const validTypes = ['dana', 'gopay', 'ovo', 'bank', 'bank_transfer', 'other'];
    if (!validTypes.includes(type)) {
      return {
        status: 400,
        message: `Tipe e-wallet tidak valid. Pilih dari: ${validTypes.join(', ')}`,
      };
    }

    const isFirst = !dataStore.paymentMethods.some((pm) => pm.user_id === userId);
    const newMethod = {
      id: `pm-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
      user_id: userId,
      type: type as any,
      account_number: account_number.trim(),
      account_name: account_name.trim(),
      is_default: isFirst,
      created_at: new Date().toISOString(),
    };

    dataStore.paymentMethods.push(newMethod);
    return { status: 201, data: newMethod };
  }

  public deletePaymentMethod(userId: string, methodId: string): { status: number; message?: string } {
    const idx = dataStore.paymentMethods.findIndex((pm) => pm.id === methodId && pm.user_id === userId);
    if (idx === -1) {
      return { status: 404, message: 'Metode pembayaran tidak ditemukan' };
    }
    dataStore.paymentMethods.splice(idx, 1);
    return { status: 200 };
  }

  public pairNfc(
    userId: string,
    nfcUid: string
  ): { status: number; message?: string; data?: any } {
    const cleanUid = nfcUid.trim().toUpperCase();

    // Check if NFC UID is already paired to another active wallet
    for (const [wUserId, existingWallet] of Array.from(cashlessRepository.getAllWallets().entries())) {
      if (existingWallet.nfc_uid === cleanUid && wUserId !== userId) {
        return {
          status: 409,
          message: `NFC UID '${cleanUid}' is already paired to another attendee wallet`,
        };
      }
    }

    const wallet = this.getOrCreateWallet(userId);
    wallet.nfc_uid = cleanUid;

    logger.info(`[Cashless] Paired NFC UID ${cleanUid} to user ${userId}`);

    return {
      status: 200,
      data: {
        wallet,
        paired_nfc_uid: cleanUid,
      },
    };
  }

  public debitBooth(
    dto: DebitBoothDto,
    fallbackUserId?: string
  ): { status: number; message?: string; data?: any } {
    const { amount, nfc_uid, user_id, reference_id, booth_name = 'F&B Booth #1', items_summary } = dto;

    // Check idempotency: if reference_id seen before, return cached transaction
    const existingTx = cashlessRepository.findTxById(reference_id);
    if (existingTx) {
      const existingWallet = cashlessRepository.getWalletById(existingTx.wallet_id);
      return {
        status: 200,
        data: {
          wallet: existingWallet,
          transaction: existingTx,
          idempotent_response: true,
        },
        message: 'Transaction already processed (Idempotent response)',
      };
    }

    // Find wallet by NFC UID or user_id
    let targetWallet: DemoWallet | undefined;
    if (nfc_uid) {
      targetWallet = cashlessRepository.getWalletByNfcUid(nfc_uid);
    } else if (user_id) {
      targetWallet = cashlessRepository.getWalletByUserId(user_id);
    } else if (fallbackUserId) {
      targetWallet = cashlessRepository.getWalletByUserId(fallbackUserId);
    }

    if (!targetWallet) {
      return {
        status: 404,
        message: `Wallet not found for ${nfc_uid ? `NFC '${nfc_uid}'` : 'user'}`,
      };
    }

    // Balance check
    if (targetWallet.balance < amount) {
      return {
        status: 402,
        message: `Insufficient balance. Saldo: Rp ${targetWallet.balance.toLocaleString('id-ID')}, Dibutuhkan: Rp ${amount.toLocaleString('id-ID')}`,
      };
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

    cashlessRepository.addTransaction(tx);

    logger.info(
      `[Cashless] Booth debit success — ${booth_name}: Rp ${amount} debited from wallet ${targetWallet.id} (ref=${reference_id})`
    );

    return {
      status: 200,
      data: {
        wallet: targetWallet,
        transaction: tx,
        remaining_balance: targetWallet.balance,
      },
    };
  }

  public refundBoothTx(
    transactionId: string,
    reason: string = 'Customer refund request'
  ): { status: number; message?: string; data?: any } {
    const txIndex = cashlessRepository.findTxIndexById(transactionId);
    if (txIndex === -1) {
      return { status: 404, message: 'Transaction not found' };
    }

    const origTx = dataStore.walletTxs[txIndex];
    if (origTx.type !== 'payment') {
      return {
        status: 400,
        message: `Only 'payment' transactions can be refunded (type is '${origTx.type}')`,
      };
    }

    const wallet = cashlessRepository.getWalletById(origTx.wallet_id);
    if (!wallet) {
      return { status: 404, message: 'Associated wallet not found' };
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

    cashlessRepository.addTransaction(refundTx);

    return {
      status: 200,
      data: {
        wallet,
        refund_transaction: refundTx,
      },
    };
  }

  public autoRefundJob(
    eventId: string = 'evt-001',
    tenantId: string = 'tenant-001'
  ): { wallets_refunded: number; total_refunded_amount: number } {
    let refundedCount = 0;
    let totalRefundedAmount = 0;

    for (const [, wallet] of Array.from(cashlessRepository.getAllWallets().entries())) {
      if (wallet.event_id === eventId && wallet.balance > 0) {
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

        cashlessRepository.addTransaction(refundTx);
        refundedCount++;
        totalRefundedAmount += amountToRefund;

        publishEvent(
          'refund.processed',
          {
            wallet_id: wallet.id,
            user_id: wallet.user_id,
            amount: amountToRefund,
            event_id: eventId,
          },
          tenantId
        ).catch(() => {});
      }
    }

    logger.info(
      `[Cashless] Auto-refund job completed: ${refundedCount} wallet(s) refunded, total Rp ${totalRefundedAmount}`
    );

    return {
      wallets_refunded: refundedCount,
      total_refunded_amount: totalRefundedAmount,
    };
  }

  public getBoothHistory(): DemoWalletTx[] {
    return cashlessRepository.getBoothTransactions();
  }
}

export const cashlessService = new CashlessService();
