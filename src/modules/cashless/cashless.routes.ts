/**
 * src/modules/cashless/cashless.routes.ts
 *
 * FASE 8 — Cashless Service routes
 *
 * Endpoints:
 *   GET  /cashless/wallet             — detail saldo & NFC UID user
 *   POST /cashless/wallet/topup       — top-up saldo wallet
 *   POST /cashless/wallet/pair-nfc    — pair wristband NFC UID ke wallet
 *   POST /cashless/booth/debit        — transaksi debit kasir booth (idempotent reference_id)
 *   POST /cashless/booth/refund       — refund transaksi booth
 *   POST /cashless/wallet/auto-refund — automated post-event refund job (admin/organizer)
 *   GET  /cashless/booth/history      — riwayat transaksi booth
 */

import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/rbac.middleware';
import {
  getWallet,
  topupWallet,
  confirmTopup,
  topupWebhook,
  pairNfc,
  debitBooth,
  refundBoothTx,
  autoRefundJob,
  getBoothHistory,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
} from './cashless.controller';

const router = Router();

router.get('/wallet', authenticate, getWallet);
router.post('/wallet/topup', authenticate, topupWallet);
router.post('/wallet/topup/confirm', authenticate, confirmTopup);
router.post('/wallet/topup/webhook', topupWebhook);
router.post('/wallet/pair-nfc', authenticate, pairNfc);

router.get('/payment-methods', authenticate, getPaymentMethods);
router.post('/payment-methods', authenticate, addPaymentMethod);
router.delete('/payment-methods/:id', authenticate, deletePaymentMethod);

router.post('/booth/debit', authenticate, requireRole(['vendor', 'admin', 'organizer', 'superadmin']), debitBooth);
router.post('/booth/refund', authenticate, requireRole(['vendor', 'admin', 'organizer', 'superadmin']), refundBoothTx);
router.get('/booth/history', authenticate, requireRole(['vendor', 'admin', 'organizer', 'superadmin']), getBoothHistory);

router.post('/wallet/auto-refund', authenticate, requireRole(['admin', 'organizer', 'superadmin']), autoRefundJob);

export default router;

