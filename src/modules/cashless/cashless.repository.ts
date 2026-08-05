import { dataStore, DemoWallet, DemoWalletTx } from '../../database/dataStore';

export class CashlessRepository {
  getWalletByUserId(userId: string): DemoWallet | undefined {
    return dataStore.wallets.get(userId);
  }

  saveWallet(userId: string, wallet: DemoWallet): void {
    dataStore.wallets.set(userId, wallet);
  }

  getWalletByNfcUid(nfcUid: string): DemoWallet | undefined {
    const cleanUid = nfcUid.trim().toUpperCase();
    return Array.from(dataStore.wallets.values()).find((w) => w.nfc_uid === cleanUid);
  }

  getWalletById(walletId: string): DemoWallet | undefined {
    return Array.from(dataStore.wallets.values()).find((w) => w.id === walletId);
  }

  getTransactionsByWalletId(walletId: string): DemoWalletTx[] {
    return dataStore.walletTxs.filter((t) => t.wallet_id === walletId);
  }

  findTxById(txId: string): DemoWalletTx | undefined {
    return dataStore.walletTxs.find((t) => t.id === txId || t.description.includes(txId));
  }

  findTxIndexById(txId: string): number {
    return dataStore.walletTxs.findIndex((t) => t.id === txId);
  }

  addTransaction(tx: DemoWalletTx): void {
    dataStore.walletTxs.unshift(tx);
  }

  getAllWallets(): Map<string, DemoWallet> {
    return dataStore.wallets;
  }

  getBoothTransactions(): DemoWalletTx[] {
    return dataStore.walletTxs.filter((t) => t.type === 'payment' || t.type === 'refund');
  }
}

export const cashlessRepository = new CashlessRepository();
