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

const apiKey = 'test-brevo-api-key';
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

function createFakeEmailSender({ fetchImpl, timeoutMs = 100 }) {
  const state = {
    calls: []
  };

  const sender = createConfirmationEmailSender({
    apiKey,
    emailFrom,
    timeoutMs,
    fetchImpl: async (url, options) => {
      state.calls.push({ url, options });
      return fetchImpl(url, options);
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
    let wasStoredBeforeDelivery = false;
    const { sender, state } = createFakeEmailSender({
      fetchImpl: async () => {
        const stored = await registrationRepository.findByEventIdAndEmail(
          event.id,
          'ada@example.com'
        );
        wasStoredBeforeDelivery = Boolean(stored);
        return { ok: true, status: 201 };
      }
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });

    const registration = await service.registerForEvent(event.id, {
      name: 'Ada',
      email: 'ada@example.com'
    });

    assert.equal(registration.email, 'ada@example.com');
    assert.equal(wasStoredBeforeDelivery, true);
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0].url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(state.calls[0].options.method, 'POST');
    assert.equal(state.calls[0].options.headers['api-key'], apiKey);
    const message = JSON.parse(state.calls[0].options.body);
    assert.deepEqual(message.sender, {
      name: 'Campus Events',
      email: 'noreply@example.com'
    });
    assert.deepEqual(message.to, [{ name: 'Ada', email: 'ada@example.com' }]);
    assert.match(message.textContent, /Backend Bootcamp/);
    assert.match(message.textContent, /2030-05-20T12:00:00.000Z/);
    assert.match(message.textContent, /Room C101/);
    await assertRegistrationStored(event.id, 'ada@example.com');
  });

  it('keeps the registration when Brevo rejects the request', async () => {
    const event = await createEvent();
    const { sender, state } = createFakeEmailSender({
      fetchImpl: async () => ({ ok: false, status: 400 })
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });

    const registration = await service.registerForEvent(event.id, {
      name: 'Grace',
      email: 'grace@example.com'
    });

    assert.equal(registration.email, 'grace@example.com');
    assert.equal(state.calls.length, 1);
    await assertRegistrationStored(event.id, 'grace@example.com');
  });

  it('aborts a timed-out request and handles a late rejection', async () => {
    const event = await createEvent();
    let wasAborted = false;
    const { sender } = createFakeEmailSender({
      timeoutMs: 10,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          wasAborted = true;
          setTimeout(() => reject(new Error('late provider rejection')), 10);
        });
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
    assert.equal(wasAborted, true);
    await assertRegistrationStored(event.id, 'alan@example.com');

    // Let the fake provider reject after the timeout; it must not become unhandled.
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('keeps the registration when Brevo configuration is missing', async () => {
    const event = await createEvent();
    let fetchCalls = 0;
    const sender = createConfirmationEmailSender({
      apiKey: null,
      emailFrom,
      timeoutMs: 10,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('fetch must not be called');
      }
    });
    const service = createRegistrationService({ sendConfirmationEmail: sender });

    const registration = await service.registerForEvent(event.id, {
      name: 'Katherine',
      email: 'katherine@example.com'
    });

    assert.equal(registration.email, 'katherine@example.com');
    assert.equal(fetchCalls, 0);
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
