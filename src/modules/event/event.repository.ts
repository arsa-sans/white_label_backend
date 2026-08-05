import { dataStore, DemoEvent, DemoSeatCategory } from '../../database/dataStore';

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

  getSeatsByEventId(eventId: string) {
    return dataStore.seats.filter((s) => s.event_id === eventId);
  }

  getCategoriesByEventId(eventId: string): DemoSeatCategory[] {
    return dataStore.seatCategories.filter((c) => c.event_id === eventId);
  }

  addCategory(category: DemoSeatCategory): void {
    dataStore.seatCategories.push(category);
  }

  removeCategoryById(catId: string): boolean {
    const idx = dataStore.seatCategories.findIndex((c) => c.id === catId);
    if (idx === -1) return false;
    dataStore.seatCategories.splice(idx, 1);
    return true;
  }

  expireLockedSeats(eventId: string): void {
    const now = Date.now();
    dataStore.seats.forEach((seat) => {
      if (seat.event_id === eventId && seat.status === 'locked' && seat.locked_until) {
        if (new Date(seat.locked_until).getTime() < now) {
          seat.status = 'available';
          seat.locked_until = undefined;
          seat.locked_by_user_id = undefined;
        }
      }
    });
  }
}

export const eventRepository = new EventRepository();
