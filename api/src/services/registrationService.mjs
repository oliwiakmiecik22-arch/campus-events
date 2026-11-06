import { logger } from '../config/logger.mjs';
import { conflict, eventNotFound } from '../errors/AppError.mjs';
import * as eventRepository from '../repositories/eventRepository.mjs';
import * as registrationRepository from '../repositories/registrationRepository.mjs';

export async function listRegistrations(eventId) {
  const event = await eventRepository.findById(eventId);
  if (!event) {
    throw eventNotFound(eventId);
  }

  return registrationRepository.findAllByEventId(event.id);
}

export async function registerForEvent(eventId, data) {
  const event = await eventRepository.findById(eventId);
  if (!event) {
    throw eventNotFound(eventId);
  }

  const existing = await registrationRepository.findByEventIdAndEmail(event.id, data.email);
  if (existing) {
    throw conflict(`${data.email} is already registered for this event`);
  }

  const count = await registrationRepository.countByEventId(event.id);
  // Keep the original capacity rule unchanged; correcting it is a later assignment step.
  if (count > event.capacity) {
    throw conflict('Event is full');
  }

  const registration = await registrationRepository.create({
    eventId: event.id,
    name: data.name,
    email: data.email
  });
  logger.info(`new registration for ${event.title}: ${data.name} <${data.email}>`);
  return registration;
}
