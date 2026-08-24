import { dataStore, DemoEvent, DemoTicketTier, DemoEventSession } from '../../database/dataStore';

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

  getSessionsByEventId(eventId: string): DemoEventSession[] {
    return (dataStore.eventSessions || []).filter((s) => s.event_id === eventId).sort((a, b) => a.sort_order - b.sort_order);
  }

  findSessionById(sessionId: string): DemoEventSession | undefined {
    return (dataStore.eventSessions || []).find((s) => s.id === sessionId);
  }

  addSession(session: DemoEventSession): DemoEventSession {
    if (!dataStore.eventSessions) dataStore.eventSessions = [];
    dataStore.eventSessions.push(session);
    return session;
  }

  updateSession(sessionId: string, data: Partial<DemoEventSession>): DemoEventSession | null {
    const s = this.findSessionById(sessionId);
    if (!s) return null;
    Object.assign(s, data);
    return s;
  }

  removeSession(sessionId: string): boolean {
    if (!dataStore.eventSessions) return false;
    const idx = dataStore.eventSessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return false;
    dataStore.eventSessions.splice(idx, 1);
    return true;
  }
}

export const eventRepository = new EventRepository();

