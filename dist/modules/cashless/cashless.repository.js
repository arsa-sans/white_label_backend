"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashlessRepository = exports.CashlessRepository = void 0;
const dataStore_1 = require("../../database/dataStore");
class CashlessRepository {
    getWalletByUserId(userId) {
        return dataStore_1.dataStore.wallets.get(userId);
    }
    saveWallet(userId, wallet) {
        dataStore_1.dataStore.wallets.set(userId, wallet);
    }
    getWalletByNfcUid(nfcUid) {
        const cleanUid = nfcUid.trim().toUpperCase();
        return Array.from(dataStore_1.dataStore.wallets.values()).find((w) => w.nfc_uid === cleanUid);
    }
    getWalletById(walletId) {
        return Array.from(dataStore_1.dataStore.wallets.values()).find((w) => w.id === walletId);
    }
    getTransactionsByWalletId(walletId) {
        return dataStore_1.dataStore.walletTxs.filter((t) => t.wallet_id === walletId);
    }
    findTxById(txId) {
        return dataStore_1.dataStore.walletTxs.find((t) => t.id === txId || t.description.includes(txId));
    }
    findTxIndexById(txId) {
        return dataStore_1.dataStore.walletTxs.findIndex((t) => t.id === txId);
    }
    addTransaction(tx) {
        dataStore_1.dataStore.walletTxs.unshift(tx);
    }
    getAllWallets() {
        return dataStore_1.dataStore.wallets;
    }
    getBoothTransactions() {
        return dataStore_1.dataStore.walletTxs.filter((t) => t.type === 'payment' || t.type === 'refund');
    }
}
exports.CashlessRepository = CashlessRepository;
exports.cashlessRepository = new CashlessRepository();
//# sourceMappingURL=cashless.repository.js.map