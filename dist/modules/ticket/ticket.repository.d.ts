import { DemoSeat, DemoTicket } from '../../database/dataStore';
export declare class TicketRepository {
    findSeatById(seatId: string, eventId: string): DemoSeat | undefined;
    getSeatsByEvent(eventId: string): DemoSeat[];
    getTicketsByUser(userId: string): DemoTicket[];
    findTicketById(ticketId: string): DemoTicket | undefined;
    getEventById(eventId: string): import("../../database/dataStore").DemoEvent | undefined;
    getAllSeats(): DemoSeat[];
}
export declare const ticketRepository: TicketRepository;
//# sourceMappingURL=ticket.repository.d.ts.map