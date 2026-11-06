import * as eventRepository from '../repositories/eventRepository.mjs';
import * as registrationRepository from '../repositories/registrationRepository.mjs';

function getStatus(event, registrationCount) {
  if (registrationCount >= event.capacity) {
    return 'full';
  }
  if (new Date(event.startsAt) < new Date()) {
    return 'past';
  }
  return 'open';
}

export async function getStats() {
  const events = await eventRepository.findAll();
  const result = [];

  for (const event of events) {
    const registrations = await registrationRepository.findAllByEventId(event.id);
    let occupancy = 0;
    if (event.capacity > 0) {
      occupancy = Math.round((registrations.length / event.capacity) * 100);
    }

    result.push({
      id: event.id,
      title: event.title,
      registered: registrations.length,
      capacity: event.capacity,
      occupancy: `${occupancy}%`,
      status: getStatus(event, registrations.length)
    });
  }

  return result;
}
