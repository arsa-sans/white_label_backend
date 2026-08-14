import { dataStore, DemoTicketTier, DemoTicket } from '../../database/dataStore';

export class TicketRepository {
  findTierById(tierId: string, eventId: string): DemoTicketTier | undefined {
    return dataStore.ticketTiers.find((t) => t.id === tierId && t.event_id === eventId);
  }

  getTiersByEvent(eventId: string): DemoTicketTier[] {
    return dataStore.ticketTiers.filter((t) => t.event_id === eventId);
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

  getAllTiers(): DemoTicketTier[] {
    return dataStore.ticketTiers;
  }
}

export const ticketRepository = new TicketRepository();
