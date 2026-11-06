import { eventNotFound } from '../errors/AppError.mjs';
import * as eventRepository from '../repositories/eventRepository.mjs';
import * as registrationRepository from '../repositories/registrationRepository.mjs';

export function listEvents() {
  return eventRepository.findAllByStartDate();
}

export async function getEvent(id) {
  const event = await eventRepository.findById(id);
  if (!event) {
    throw eventNotFound(id);
  }

  const registered = await registrationRepository.countByEventId(event.id);
  return {
    ...event,
    registered,
    spotsLeft: Math.max(event.capacity - registered, 0)
  };
}

export function createEvent(data) {
  return eventRepository.create(data);
}

export async function updateEvent(id, data) {
  const event = await eventRepository.updateById(id, data);
  if (!event) {
    throw eventNotFound(id);
  }
  return event;
}

export async function deleteEvent(id) {
  const deleted = await eventRepository.deleteById(id);
  if (deleted === 0) {
    throw eventNotFound(id);
  }
}
