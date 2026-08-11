"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gateRepository = exports.GateRepository = void 0;
const dataStore_1 = require("../../database/dataStore");
class GateRepository {
    findTicketById(ticketId) {
        return dataStore_1.dataStore.tickets.find((t) => t.id === ticketId);
    }
    markTicketUsed(ticketId) {
        const ticket = this.findTicketById(ticketId);
        if (ticket)
            ticket.status = 'used';
    }
    appendScanLog(log) {
        dataStore_1.dataStore.gateScanLogs.push(log);
    }
    getAllScanLogs() {
        return dataStore_1.dataStore.gateScanLogs;
    }
    getTicketsByEventId(eventId) {
        return dataStore_1.dataStore.tickets.filter((t) => t.event_id === eventId);
    }
    getEventById(eventId) {
        return dataStore_1.dataStore.events.find((e) => e.id === eventId);
    }
}
exports.GateRepository = GateRepository;
exports.gateRepository = new GateRepository();
//# sourceMappingURL=gate.repository.js.map