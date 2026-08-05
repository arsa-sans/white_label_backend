import { dataStore, DemoSeat, DemoTicket } from '../../database/dataStore';

export class TicketRepository {
  findSeatById(seatId: string, eventId: string): DemoSeat | undefined {
    return dataStore.seats.find((s) => s.id === seatId && s.event_id === eventId);
  }

  getSeatsByEvent(eventId: string): DemoSeat[] {
    return dataStore.seats.filter((s) => s.event_id === eventId);
  }

  getTicketsByUser(userId: string): DemoTicket[] {
    return dataStore.tickets.filter((t) => t.user_id === userId);
  }

  findTicketById(ticketId: string): DemoTicket | undefined {
    return dataStore.tickets.find((t) => t.id === ticketId);
  }

  getEventById(eventId: string) {
    return dataStore.events.find((e) => e.id === eventId);
  }

  getAllSeats(): DemoSeat[] {
    return dataStore.seats;
  }
}

export const ticketRepository = new TicketRepository();
