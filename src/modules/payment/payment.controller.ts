import { Request, Response } from 'express';
import crypto from 'crypto';
import { dataStore, DemoTicket } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';
import { io } from '../../server';

export async function createOrder(req: Request, res: Response): Promise<void> {
  const { event_id, seat_ids, payment_gateway } = req.body;
  const userId = req.user?.userId;
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  if (!idempotencyKey) {
    res.status(400).json(ApiResponse.error('Idempotency key header (x-idempotency-key) is required', 400));
    return;
  }

  // Check idempotent existing order
  const existingOrder = dataStore.orders.find((o) => o.idempotency_key === idempotencyKey);
  if (existingOrder) {
    res.json(ApiResponse.success(existingOrder, 'Existing order retrieved via Idempotency Key'));
    return;
  }

  if (!event_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    res.status(400).json(ApiResponse.error('event_id and seat_ids array are required', 400));
    return;
  }

  // Calculate total amount & verify seat availability / user lock
  let totalAmount = 0;
  for (const seatId of seat_ids) {
    const seat = dataStore.seats.find((s) => s.id === seatId && s.event_id === event_id);
    if (!seat) {
      res.status(404).json(ApiResponse.error(`Seat ${seatId} not found`, 404));
      return;
    }

    if (seat.status === 'sold') {
      res.status(409).json(ApiResponse.error(`Seat ${seat.row}-${seat.number} is already sold`, 409));
      return;
    }

    totalAmount += seat.price;
  }

  const orderId = `ord-${Date.now()}`;
  const newOrder = {
    id: orderId,
    tenant_id: req.user?.tenantId || 'tenant-001',
    user_id: userId!,
    event_id,
    amount: totalAmount,
    status: 'pending' as const,
    idempotency_key: idempotencyKey,
    payment_gateway: payment_gateway || 'Midtrans QRIS',
    gateway_ref: `REF-${Math.floor(Math.random() * 899999 + 100000)}`,
    created_at: new Date().toISOString(),
    seat_ids,
  };

  dataStore.orders.push(newOrder);

  res.status(201).json(ApiResponse.success(newOrder, 'Order created successfully. Proceed to payment.'));
}

export async function processPayment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.userId;

  const order = dataStore.orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json(ApiResponse.error('Order not found', 404));
    return;
  }

  if (order.status === 'paid') {
    res.json(ApiResponse.success(order, 'Order is already paid'));
    return;
  }

  // Update order status to paid
  order.status = 'paid';

  // Issue tickets for each seat
  const issuedTickets: DemoTicket[] = [];

  for (const seatId of order.seat_ids) {
    const seat = dataStore.seats.find((s) => s.id === seatId);
    if (seat) {
      seat.status = 'sold';
      seat.locked_until = undefined;
      seat.locked_by_user_id = undefined;

      const qrSeed = crypto.randomBytes(16).toString('hex');
      const ticket: DemoTicket = {
        id: `tkt-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
        event_id: order.event_id,
        seat_id: seat.id,
        user_id: userId!,
        order_id: order.id,
        qr_seed: qrSeed,
        seat_name: `${seat.row}-${seat.number}`,
        category: seat.category,
        price: seat.price,
        status: 'valid',
        issued_at: new Date().toISOString(),
      };

      dataStore.tickets.push(ticket);
      issuedTickets.push(ticket);
    }
  }

  // Socket notification
  io.to(`event:${order.event_id}`).emit('order_paid', {
    order_id: order.id,
    event_id: order.event_id,
    seat_ids: order.seat_ids,
  });

  res.json(
    ApiResponse.success(
      {
        order,
        tickets: issuedTickets,
      },
      'Payment processed successfully! Tickets issued.'
    )
  );
}
