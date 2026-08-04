import { Request, Response } from 'express';
import { dataStore } from '../../database/dataStore';
import { ApiResponse } from '../../utils/apiResponse';

export async function listEvents(req: Request, res: Response): Promise<void> {
  const { category, search } = req.query;

  let result = dataStore.events;

  if (category && typeof category === 'string') {
    result = result.filter((e) => e.category.toLowerCase() === category.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const query = search.toLowerCase();
    result = result.filter(
      (e) => e.name.toLowerCase().includes(query) || e.location.toLowerCase().includes(query) || e.description.toLowerCase().includes(query)
    );
  }

  res.json(ApiResponse.success(result, 'Events retrieved successfully'));
}

export async function getEventById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const event = dataStore.events.find((e) => e.id === id);

  if (!event) {
    res.status(404).json(ApiResponse.error('Event not found', 404));
    return;
  }

  res.json(ApiResponse.success(event, 'Event details retrieved successfully'));
}

export async function getEventSeats(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const eventSeats = dataStore.seats.filter((s) => s.event_id === id);

  // Check and expire temporary locks older than 5 minutes
  const now = Date.now();
  eventSeats.forEach((seat) => {
    if (seat.status === 'locked' && seat.locked_until) {
      if (new Date(seat.locked_until).getTime() < now) {
        seat.status = 'available';
        seat.locked_until = undefined;
        seat.locked_by_user_id = undefined;
      }
    }
  });

  res.json(
    ApiResponse.success(
      {
        event_id: id,
        total_seats: eventSeats.length,
        available_seats: eventSeats.filter((s) => s.status === 'available').length,
        seats: eventSeats,
      },
      'Event seats layout retrieved'
    )
  );
}
