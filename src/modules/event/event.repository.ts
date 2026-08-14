import { dataStore, DemoEvent, DemoTicketTier } from '../../database/dataStore';

export class EventRepository {
  findPublicByTenant(tenantId: string) {
    return dataStore.events.filter(
      (e) => e.tenant_id === tenantId && e.status !== 'deleted'
    );
  }

  findAll() {
    return dataStore.events.filter((e) => e.status !== 'deleted');
  }

  findById(id: string): DemoEvent | undefined {
    return dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
  }

  create(event: DemoEvent): DemoEvent {
    dataStore.events.push(event);
    return event;
  }

  softDelete(id: string): void {
    const event = this.findById(id);
    if (event) event.status = 'deleted';
  }

  getTiersByEventId(eventId: string): DemoTicketTier[] {
    return dataStore.ticketTiers.filter((t) => t.event_id === eventId);
  }

  addTier(tier: DemoTicketTier): void {
    dataStore.ticketTiers.push(tier);
  }

  removeTierById(tierId: string): boolean {
    const idx = dataStore.ticketTiers.findIndex((t) => t.id === tierId);
    if (idx === -1) return false;
    dataStore.ticketTiers.splice(idx, 1);
    return true;
  }
}

export const eventRepository = new EventRepository();
