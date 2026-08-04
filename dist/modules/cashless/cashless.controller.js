"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = getWallet;
exports.topupWallet = topupWallet;
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
async function getWallet(req, res) {
    const userId = req.user?.userId;
    let wallet = dataStore_1.dataStore.wallets.get(userId);
    if (!wallet) {
        // Auto-create wallet if missing
        wallet = {
            id: `wlt-${Date.now()}`,
            user_id: userId,
            event_id: 'evt-001',
            balance: 0,
            nfc_uid: `NFC-${Math.floor(Math.random() * 899999 + 100000)}`,
        };
        dataStore_1.dataStore.wallets.set(userId, wallet);
    }
    const txs = dataStore_1.dataStore.walletTxs.filter((t) => t.wallet_id === wallet.id);
    res.json(apiResponse_1.ApiResponse.success({
        wallet,
        transactions: txs,
    }, 'Wallet details retrieved'));
}
async function topupWallet(req, res) {
    const userId = req.user?.userId;
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json(apiResponse_1.ApiResponse.error('Valid positive top-up amount is required', 400));
        return;
    }
    let wallet = dataStore_1.dataStore.wallets.get(userId);
    if (!wallet) {
        wallet = {
            id: `wlt-${Date.now()}`,
            user_id: userId,
            event_id: 'evt-001',
            balance: 0,
            nfc_uid: `NFC-${Math.floor(Math.random() * 899999 + 100000)}`,
        };
        dataStore_1.dataStore.wallets.set(userId, wallet);
    }
    wallet.balance += amount;
    const tx = {
        id: `tx-${Date.now()}`,
        wallet_id: wallet.id,
        amount,
        type: 'topup',
        description: `Top-up via QRIS Instant`,
        created_at: new Date().toISOString(),
    };
    dataStore_1.dataStore.walletTxs.unshift(tx);
    res.json(apiResponse_1.ApiResponse.success({
        wallet,
        transaction: tx,
    }, `Successfully topped up Rp ${amount.toLocaleString('id-ID')}`));
}
//# sourceMappingURL=cashless.controller.js.map