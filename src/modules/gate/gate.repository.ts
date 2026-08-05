import { dataStore, DemoGateScanLog } from '../../database/dataStore';

export class GateRepository {
  findTicketById(ticketId: string) {
    return dataStore.tickets.find((t) => t.id === ticketId);
  }

  markTicketUsed(ticketId: string): void {
    const ticket = this.findTicketById(ticketId);
    if (ticket) ticket.status = 'used';
  }

  appendScanLog(log: DemoGateScanLog): void {
    dataStore.gateScanLogs.push(log);
  }

  getAllScanLogs() {
    return dataStore.gateScanLogs;
  }

  getTicketsByEventId(eventId: string) {
    return dataStore.tickets.filter((t) => t.event_id === eventId);
  }

  getEventById(eventId: string) {
    return dataStore.events.find((e) => e.id === eventId);
  }
}

export const gateRepository = new GateRepository();
