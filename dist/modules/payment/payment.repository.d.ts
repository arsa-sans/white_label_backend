import { DemoOrder } from '../../database/dataStore';
export declare class PaymentRepository {
    findOrderById(orderId: string): DemoOrder | undefined;
    findOrderByIdempotencyKey(key: string): DemoOrder | undefined;
    saveOrder(order: DemoOrder): void;
    getOrdersByUser(userId: string): DemoOrder[];
}
export declare const paymentRepository: PaymentRepository;
//# sourceMappingURL=payment.repository.d.ts.map