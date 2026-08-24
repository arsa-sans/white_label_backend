import { eventService } from '../event.service';
import { dataStore } from '../../../database/dataStore';

describe('Multi-Day Event Session Management', () => {
  const testEventId = 'evt-001';

  beforeEach(() => {
    // Reset sessions
    dataStore.eventSessions = [];
  });

  it('should create and list event sessions', async () => {
    const session1 = eventService.createEventSession(testEventId, {
      name: 'Day 1: Opening & Rock Band',
      date: '2026-11-20',
      start_time: '14:00',
      end_time: '22:00',
      description: 'Grand opening & band performances',
      sort_order: 1,
    });

    expect(session1.status).toBe(201);
    expect(session1.data).toBeDefined();
    expect(session1.data?.id).toMatch(/^sess-/);

    const session2 = eventService.createEventSession(testEventId, {
      name: 'Day 2: Electronic & Grand Finale',
      date: '2026-11-21',
      start_time: '15:00',
      end_time: '23:30',
      description: 'DJ performances and fireworks',
      sort_order: 2,
    });

    expect(session2.status).toBe(201);

    const allSessions = eventService.listEventSessions(testEventId);
    expect(allSessions).toHaveLength(2);
    expect(allSessions[0].name).toContain('Day 1');
    expect(allSessions[1].name).toContain('Day 2');
  });

  it('should update an existing session', async () => {
    const created = eventService.createEventSession(testEventId, {
      name: 'Day 1: Indie Stage',
      date: '2026-11-20',
      start_time: '14:00',
      end_time: '22:00',
    });

    const updated = eventService.updateEventSession(testEventId, created.data!.id, {
      name: 'Day 1: Special Acoustic & Indie Stage',
      start_time: '13:30',
    });

    expect(updated.status).toBe(200);
    expect(updated.data?.name).toBe('Day 1: Special Acoustic & Indie Stage');
    expect(updated.data?.start_time).toBe('13:30');
  });

  it('should delete a session successfully', async () => {
    const created = eventService.createEventSession(testEventId, {
      name: 'Day To Delete',
      date: '2026-11-22',
      start_time: '12:00',
      end_time: '18:00',
    });

    const deleteResult = eventService.deleteEventSession(testEventId, created.data!.id);
    expect(deleteResult.status).toBe(200);

    const sessions = eventService.listEventSessions(testEventId);
    expect(sessions.find((s) => s.id === created.data!.id)).toBeUndefined();
  });
});
