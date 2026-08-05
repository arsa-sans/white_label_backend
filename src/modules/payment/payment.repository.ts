import { dataStore, DemoOrder } from '../../database/dataStore';

export class PaymentRepository {
  findOrderById(orderId: string): DemoOrder | undefined {
    return dataStore.orders.find((o) => o.id === orderId);
  }

  findOrderByIdempotencyKey(key: string): DemoOrder | undefined {
    return dataStore.orders.find((o) => o.idempotency_key === key);
  }

  saveOrder(order: DemoOrder): void {
    dataStore.orders.push(order);
  }

  getOrdersByUser(userId: string): DemoOrder[] {
    return dataStore.orders.filter((o) => o.user_id === userId);
  }
}

export const paymentRepository = new PaymentRepository();
