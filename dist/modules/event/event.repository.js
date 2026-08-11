"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventRepository = exports.EventRepository = void 0;
const dataStore_1 = require("../../database/dataStore");
class EventRepository {
    findPublicByTenant(tenantId) {
        return dataStore_1.dataStore.events.filter((e) => e.tenant_id === tenantId && e.status !== 'deleted');
    }
    findAll() {
        return dataStore_1.dataStore.events.filter((e) => e.status !== 'deleted');
    }
    findById(id) {
        return dataStore_1.dataStore.events.find((e) => e.id === id && e.status !== 'deleted');
    }
    create(event) {
        dataStore_1.dataStore.events.push(event);
        return event;
    }
    softDelete(id) {
        const event = this.findById(id);
        if (event)
            event.status = 'deleted';
    }
    getSeatsByEventId(eventId) {
        return dataStore_1.dataStore.seats.filter((s) => s.event_id === eventId);
    }
    getCategoriesByEventId(eventId) {
        return dataStore_1.dataStore.seatCategories.filter((c) => c.event_id === eventId);
    }
    addCategory(category) {
        dataStore_1.dataStore.seatCategories.push(category);
    }
    removeCategoryById(catId) {
        const idx = dataStore_1.dataStore.seatCategories.findIndex((c) => c.id === catId);
        if (idx === -1)
            return false;
        dataStore_1.dataStore.seatCategories.splice(idx, 1);
        return true;
    }
    expireLockedSeats(eventId) {
        const now = Date.now();
        dataStore_1.dataStore.seats.forEach((seat) => {
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
exports.EventRepository = EventRepository;
exports.eventRepository = new EventRepository();
//# sourceMappingURL=event.repository.js.map