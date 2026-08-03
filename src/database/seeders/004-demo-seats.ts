import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

const EVENT_ID = '00000000-0000-0000-0002-000000000001';
const VENUE_ID = '00000000-0000-0000-0003-000000000001';

// 2 VIP rows × 5 seats + 2 Regular rows × 5 seats = 20 seats
const seats: Array<{
  id: string;
  event_id: string;
  venue_id: string;
  row: string;
  number: number;
  category: string;
  price: number;
  status: string;
  locked_at: null;
  locked_by_user_id: null;
  created_at: Date;
  updated_at: Date;
}> = [];

// VIP rows: V1, V2
['V1', 'V2'].forEach((row) => {
  for (let num = 1; num <= 5; num++) {
    seats.push({
      id: uuidv4(),
      event_id: EVENT_ID,
      venue_id: VENUE_ID,
      row,
      number: num,
      category: 'VIP',
      price: 500000, // IDR 500.000
      status: 'available',
      locked_at: null,
      locked_by_user_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
});

// Regular rows: R1, R2
['R1', 'R2'].forEach((row) => {
  for (let num = 1; num <= 5; num++) {
    seats.push({
      id: uuidv4(),
      event_id: EVENT_ID,
      venue_id: VENUE_ID,
      row,
      number: num,
      category: 'Regular',
      price: 150000, // IDR 150.000
      status: 'available',
      locked_at: null,
      locked_by_user_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
});

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkInsert('seats', seats);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('seats', { event_id: EVENT_ID } as Record<string, unknown>);
}
