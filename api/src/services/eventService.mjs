import {
  responseCache,
  responseCacheKeys
} from '../cache/responseCache.mjs';
import { eventNotFound } from '../errors/AppError.mjs';
import * as eventRepository from '../repositories/eventRepository.mjs';
import * as registrationRepository from '../repositories/registrationRepository.mjs';

export function listEvents() {
  return responseCache.getOrLoad(
    responseCacheKeys.eventList,
    () => eventRepository.findAllByStartDate()
  );
}

export async function getEvent(id) {
  return responseCache.getOrLoad(responseCacheKeys.event(id), async () => {
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
  });
}

export async function createEvent(data) {
  const event = await eventRepository.create(data);
  responseCache.invalidate(responseCacheKeys.eventList, responseCacheKeys.stats);
  return event;
}

export async function updateEvent(id, data) {
  const event = await eventRepository.updateById(id, data);
  if (!event) {
    throw eventNotFound(id);
  }
  responseCache.invalidate(
    responseCacheKeys.eventList,
    responseCacheKeys.event(id),
    responseCacheKeys.stats
  );
  return event;
}

export async function deleteEvent(id) {
  const deleted = await eventRepository.deleteById(id);
  if (deleted === 0) {
    throw eventNotFound(id);
  }
  responseCache.invalidate(
    responseCacheKeys.eventList,
    responseCacheKeys.event(id),
    responseCacheKeys.registrations(id),
    responseCacheKeys.stats
  );
}
