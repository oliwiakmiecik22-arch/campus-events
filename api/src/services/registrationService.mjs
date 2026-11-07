import { logger } from '../config/logger.mjs';
import { conflict, eventNotFound } from '../errors/AppError.mjs';
import * as eventRepository from '../repositories/eventRepository.mjs';
import * as registrationRepository from '../repositories/registrationRepository.mjs';
import {
  ConfirmationEmailError,
  sendConfirmationEmail as defaultConfirmationEmailSender
} from './confirmationEmailService.mjs';

export async function listRegistrations(eventId) {
  const event = await eventRepository.findById(eventId);
  if (!event) {
    throw eventNotFound(eventId);
  }

  return registrationRepository.findAllByEventId(event.id);
}

async function attemptConfirmationEmail(sendConfirmationEmail, registration, event) {
  try {
    await sendConfirmationEmail({ registration, event });
  } catch (error) {
    const reason = error instanceof ConfirmationEmailError
      ? error.code
      : 'EMAIL_DELIVERY_FAILED';
    logger.warn('confirmation email was not sent', {
      registrationId: registration.id,
      reason
    });
  }
}

export function createRegistrationService({
  sendConfirmationEmail = defaultConfirmationEmailSender
} = {}) {
  return {
    async registerForEvent(eventId, data) {
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

      // The database write is complete before this best-effort external call.
      await attemptConfirmationEmail(sendConfirmationEmail, registration, event);
      return registration;
    }
  };
}

const registrationService = createRegistrationService();
export const registerForEvent = registrationService.registerForEvent;
