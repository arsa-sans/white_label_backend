import { DemoWallet, DemoWalletTx } from '../../database/dataStore';
export declare class CashlessRepository {
    getWalletByUserId(userId: string): DemoWallet | undefined;
    saveWallet(userId: string, wallet: DemoWallet): void;
    getWalletByNfcUid(nfcUid: string): DemoWallet | undefined;
    getWalletById(walletId: string): DemoWallet | undefined;
    getTransactionsByWalletId(walletId: string): DemoWalletTx[];
    findTxById(txId: string): DemoWalletTx | undefined;
    findTxIndexById(txId: string): number;
    addTransaction(tx: DemoWalletTx): void;
    getAllWallets(): Map<string, DemoWallet>;
    getBoothTransactions(): DemoWalletTx[];
}
export declare const cashlessRepository: CashlessRepository;
//# sourceMappingURL=cashless.repository.d.ts.map