import { dataStore } from '../../database/dataStore';
import { DemoPayoutRequest } from './analytics.types';

export class AnalyticsRepository {
  private payoutStore: DemoPayoutRequest[] = [
    {
      id: 'pay-001',
      tenant_id: 'tenant-001',
      organizer_id: 'user-organizer-001',
      event_id: 'evt-001',
      amount: 150000000,
      bank_name: 'BCA',
      account_number: '8820194821',
      account_holder: 'PT Elena Media Utama',
      status: 'paid',
      requested_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      processed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  public getEvents(eventId?: string) {
    return eventId ? dataStore.events.filter((e) => e.id === eventId) : dataStore.events;
  }

  public getTicketTiers(eventId?: string) {
    return eventId ? dataStore.ticketTiers.filter((t) => t.event_id === eventId) : dataStore.ticketTiers;
  }

  public getTickets(eventId?: string) {
    return eventId ? dataStore.tickets.filter((t) => t.event_id === eventId) : dataStore.tickets;
  }

  public getPaidOrders(eventId?: string) {
    const paid = dataStore.orders.filter((o) => o.status === 'paid');
    return eventId ? paid.filter((o) => o.event_id === eventId) : paid;
  }

  public getGateScanLogs() {
    return dataStore.gateScanLogs;
  }

  public getPayouts(organizerId?: string): DemoPayoutRequest[] {
    if (organizerId) {
      return this.payoutStore.filter((p) => p.organizer_id === organizerId);
    }
    return this.payoutStore;
  }

  public findPayoutById(id: string): DemoPayoutRequest | undefined {
    return this.payoutStore.find((p) => p.id === id);
  }

  public addPayout(payout: DemoPayoutRequest): void {
    this.payoutStore.unshift(payout);
  }
}

export const analyticsRepository = new AnalyticsRepository();
