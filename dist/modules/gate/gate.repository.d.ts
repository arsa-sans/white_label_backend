import { DemoGateScanLog } from '../../database/dataStore';
export declare class GateRepository {
    findTicketById(ticketId: string): import("../../database/dataStore").DemoTicket | undefined;
    markTicketUsed(ticketId: string): void;
    appendScanLog(log: DemoGateScanLog): void;
    getAllScanLogs(): DemoGateScanLog[];
    getTicketsByEventId(eventId: string): import("../../database/dataStore").DemoTicket[];
    getEventById(eventId: string): import("../../database/dataStore").DemoEvent | undefined;
}
export declare const gateRepository: GateRepository;
//# sourceMappingURL=gate.repository.d.ts.map