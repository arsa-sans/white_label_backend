"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketRepository = exports.TicketRepository = void 0;
const dataStore_1 = require("../../database/dataStore");
class TicketRepository {
    findSeatById(seatId, eventId) {
        return dataStore_1.dataStore.seats.find((s) => s.id === seatId && s.event_id === eventId);
    }
    getSeatsByEvent(eventId) {
        return dataStore_1.dataStore.seats.filter((s) => s.event_id === eventId);
    }
    getTicketsByUser(userId) {
        return dataStore_1.dataStore.tickets.filter((t) => t.user_id === userId);
    }
    findTicketById(ticketId) {
        return dataStore_1.dataStore.tickets.find((t) => t.id === ticketId);
    }
    getEventById(eventId) {
        return dataStore_1.dataStore.events.find((e) => e.id === eventId);
    }
    getAllSeats() {
        return dataStore_1.dataStore.seats;
    }
}
exports.TicketRepository = TicketRepository;
exports.ticketRepository = new TicketRepository();
//# sourceMappingURL=ticket.repository.js.map