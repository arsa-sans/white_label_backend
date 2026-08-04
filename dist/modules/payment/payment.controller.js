"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.processPayment = processPayment;
const crypto_1 = __importDefault(require("crypto"));
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
const server_1 = require("../../server");
async function createOrder(req, res) {
    const { event_id, seat_ids, payment_gateway } = req.body;
    const userId = req.user?.userId;
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
        res.status(400).json(apiResponse_1.ApiResponse.error('Idempotency key header (x-idempotency-key) is required', 400));
        return;
    }
    // Check idempotent existing order
    const existingOrder = dataStore_1.dataStore.orders.find((o) => o.idempotency_key === idempotencyKey);
    if (existingOrder) {
        res.json(apiResponse_1.ApiResponse.success(existingOrder, 'Existing order retrieved via Idempotency Key'));
        return;
    }
    if (!event_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id and seat_ids array are required', 400));
        return;
    }
    // Calculate total amount & verify seat availability / user lock
    let totalAmount = 0;
    for (const seatId of seat_ids) {
        const seat = dataStore_1.dataStore.seats.find((s) => s.id === seatId && s.event_id === event_id);
        if (!seat) {
            res.status(404).json(apiResponse_1.ApiResponse.error(`Seat ${seatId} not found`, 404));
            return;
        }
        if (seat.status === 'sold') {
            res.status(409).json(apiResponse_1.ApiResponse.error(`Seat ${seat.row}-${seat.number} is already sold`, 409));
            return;
        }
        totalAmount += seat.price;
    }
    const orderId = `ord-${Date.now()}`;
    const newOrder = {
        id: orderId,
        tenant_id: req.user?.tenantId || 'tenant-001',
        user_id: userId,
        event_id,
        amount: totalAmount,
        status: 'pending',
        idempotency_key: idempotencyKey,
        payment_gateway: payment_gateway || 'Midtrans QRIS',
        gateway_ref: `REF-${Math.floor(Math.random() * 899999 + 100000)}`,
        created_at: new Date().toISOString(),
        seat_ids,
    };
    dataStore_1.dataStore.orders.push(newOrder);
    res.status(201).json(apiResponse_1.ApiResponse.success(newOrder, 'Order created successfully. Proceed to payment.'));
}
async function processPayment(req, res) {
    const { id } = req.params;
    const userId = req.user?.userId;
    const order = dataStore_1.dataStore.orders.find((o) => o.id === id);
    if (!order) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Order not found', 404));
        return;
    }
    if (order.status === 'paid') {
        res.json(apiResponse_1.ApiResponse.success(order, 'Order is already paid'));
        return;
    }
    // Update order status to paid
    order.status = 'paid';
    // Issue tickets for each seat
    const issuedTickets = [];
    for (const seatId of order.seat_ids) {
        const seat = dataStore_1.dataStore.seats.find((s) => s.id === seatId);
        if (seat) {
            seat.status = 'sold';
            seat.locked_until = undefined;
            seat.locked_by_user_id = undefined;
            const qrSeed = crypto_1.default.randomBytes(16).toString('hex');
            const ticket = {
                id: `tkt-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
                event_id: order.event_id,
                seat_id: seat.id,
                user_id: userId,
                order_id: order.id,
                qr_seed: qrSeed,
                seat_name: `${seat.row}-${seat.number}`,
                category: seat.category,
                price: seat.price,
                status: 'valid',
                issued_at: new Date().toISOString(),
            };
            dataStore_1.dataStore.tickets.push(ticket);
            issuedTickets.push(ticket);
        }
    }
    // Socket notification
    server_1.io.to(`event:${order.event_id}`).emit('order_paid', {
        order_id: order.id,
        event_id: order.event_id,
        seat_ids: order.seat_ids,
    });
    res.json(apiResponse_1.ApiResponse.success({
        order,
        tickets: issuedTickets,
    }, 'Payment processed successfully! Tickets issued.'));
}
//# sourceMappingURL=payment.controller.js.map