import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import * as eventRepository from '../../src/repositories/eventRepository.mjs';
import * as registrationRepository from '../../src/repositories/registrationRepository.mjs';
import {
  createConfirmationEmailSender
} from '../../src/services/confirmationEmailService.mjs';
import {
  createRegistrationService
} from '../../src/services/registrationService.mjs';
import { resetDatabase } from '../../src/services/setupService.mjs';

const smtpUrl = 'smtp://mailer.example.test:2525';
const emailFrom = 'Campus Events <noreply@example.com>';

async function createEvent() {
  return eventRepository.create({
    title: 'Backend Bootcamp',
    description: 'Learn the API basics.',
    location: 'Room C101',
    startsAt: new Date('2030-05-20T12:00:00.000Z'),
    capacity: 10
  });
}

async function assertRegistrationStored(eventId, email) {
  const registrations = await registrationRepository.findAllByEventId(eventId);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].email, email);
}

function createFakeEmailSender({ sendMail, timeoutMs = 100 }) {
  const state = {
    closeCalls: 0,
    transportCalls: 0,
    transportOptions: null
  };

  const sender = createConfirmationEmailSender({
    smtpUrl,
    emailFrom,
    timeoutMs,
    transportFactory: (_url, options) => {
      state.transportCalls += 1;
      state.transportOptions = options;
      return {
        sendMail,
        close() {
          state.closeCalls += 1;
        }
      };
    }
  });

  return { sender, state };
}

describe('registration confirmation email', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('saves the registration before a successful plain-text email', async () => {
    const event = await createEvent();
    let message;
    let wasStoredBeforeDelivery = false;
    const { sender, state } = createFakeEmailSender({
      sendMail: async (mail) => {
        message = mail;
        const stored = await registrationRepository.findByEventIdAndEmail(
          event.id,
          'ada@example.com'
        );
        wasStoredBeforeDelivery = Boolean(stored);
      }
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });

    const registration = await service.registerForEvent(event.id, {
      name: 'Ada',
      email: 'ada@example.com'
    });

    assert.equal(registration.email, 'ada@example.com');
    assert.equal(wasStoredBeforeDelivery, true);
    assert.equal(message.from, emailFrom);
    assert.equal(message.to, 'ada@example.com');
    assert.match(message.text, /Backend Bootcamp/);
    assert.match(message.text, /2030-05-20T12:00:00.000Z/);
    assert.match(message.text, /Room C101/);
    assert.equal(state.transportOptions.connectionTimeout, 100);
    assert.equal(state.transportOptions.greetingTimeout, 100);
    assert.equal(state.transportOptions.socketTimeout, 100);
    assert.equal(state.closeCalls, 1);
    await assertRegistrationStored(event.id, 'ada@example.com');
  });

  it('keeps the registration when the provider rejects delivery', async () => {
    const event = await createEvent();
    const { sender, state } = createFakeEmailSender({
      sendMail: async () => {
        throw new Error('raw provider error with smtp credentials');
      }
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });

    const registration = await service.registerForEvent(event.id, {
      name: 'Grace',
      email: 'grace@example.com'
    });

    assert.equal(registration.email, 'grace@example.com');
    assert.equal(state.transportCalls, 1);
    assert.equal(state.closeCalls, 1);
    await assertRegistrationStored(event.id, 'grace@example.com');
  });

  it('times out, closes the transport and handles a late rejection', async () => {
    const event = await createEvent();
    const { sender, state } = createFakeEmailSender({
      timeoutMs: 10,
      sendMail: () => new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('late provider rejection')), 30);
      })
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });
    const startedAt = Date.now();

    const registration = await service.registerForEvent(event.id, {
      name: 'Alan',
      email: 'alan@example.com'
    });

    assert.equal(registration.email, 'alan@example.com');
    assert.ok(Date.now() - startedAt < 500);
    assert.equal(state.closeCalls, 1);
    await assertRegistrationStored(event.id, 'alan@example.com');

    // Let the fake provider reject after the timeout; it must not become unhandled.
    await new Promise((resolve) => setTimeout(resolve, 40));
  });

  it('keeps the registration when SMTP configuration is missing', async () => {
    const event = await createEvent();
    let transportCalls = 0;
    const sender = createConfirmationEmailSender({
      smtpUrl: null,
      emailFrom: null,
      timeoutMs: 10,
      transportFactory: () => {
        transportCalls += 1;
        throw new Error('transport must not be created');
      }
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });

    const registration = await service.registerForEvent(event.id, {
      name: 'Katherine',
      email: 'katherine@example.com'
    });

    assert.equal(registration.email, 'katherine@example.com');
    assert.equal(transportCalls, 0);
    await assertRegistrationStored(event.id, 'katherine@example.com');
  });

  it('does not send email when a duplicate registration is rejected', async () => {
    const event = await createEvent();
    await registrationRepository.create({
      eventId: event.id,
      name: 'Ada',
      email: 'ada@example.com'
    });
    let sendCalls = 0;
    const service = createRegistrationService({
      sendConfirmationEmail: async () => {
        sendCalls += 1;
      }
    });

    await assert.rejects(
      service.registerForEvent(event.id, {
        name: 'Ada again',
        email: 'ada@example.com'
      }),
      (error) => error.code === 'CONFLICT'
    );

    assert.equal(sendCalls, 0);
    await assertRegistrationStored(event.id, 'ada@example.com');
  });
});
