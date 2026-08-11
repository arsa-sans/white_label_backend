import { DemoEvent, DemoSeatCategory } from '../../database/dataStore';
export declare class EventRepository {
    findPublicByTenant(tenantId: string): DemoEvent[];
    findAll(): DemoEvent[];
    findById(id: string): DemoEvent | undefined;
    create(event: DemoEvent): DemoEvent;
    softDelete(id: string): void;
    getSeatsByEventId(eventId: string): import("../../database/dataStore").DemoSeat[];
    getCategoriesByEventId(eventId: string): DemoSeatCategory[];
    addCategory(category: DemoSeatCategory): void;
    removeCategoryById(catId: string): boolean;
    expireLockedSeats(eventId: string): void;
}
export declare const eventRepository: EventRepository;
//# sourceMappingURL=event.repository.d.ts.map