"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRepository = exports.PaymentRepository = void 0;
const dataStore_1 = require("../../database/dataStore");
class PaymentRepository {
    findOrderById(orderId) {
        return dataStore_1.dataStore.orders.find((o) => o.id === orderId);
    }
    findOrderByIdempotencyKey(key) {
        return dataStore_1.dataStore.orders.find((o) => o.idempotency_key === key);
    }
    saveOrder(order) {
        dataStore_1.dataStore.orders.push(order);
    }
    getOrdersByUser(userId) {
        return dataStore_1.dataStore.orders.filter((o) => o.user_id === userId);
    }
}
exports.PaymentRepository = PaymentRepository;
exports.paymentRepository = new PaymentRepository();
//# sourceMappingURL=payment.repository.js.map