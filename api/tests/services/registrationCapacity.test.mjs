import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import * as eventRepository from '../../src/repositories/eventRepository.mjs';
import * as registrationRepository from '../../src/repositories/registrationRepository.mjs';
import { createRegistrationService } from '../../src/services/registrationService.mjs';
import { resetDatabase } from '../../src/services/setupService.mjs';

describe('registration capacity', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('stores only the first registration when capacity is one', async () => {
    const event = await eventRepository.create({
      title: 'One-seat workshop',
      description: null,
      location: 'Room C101',
      startsAt: new Date('2030-05-20T12:00:00.000Z'),
      capacity: 1
    });
    let emailCalls = 0;
    const service = createRegistrationService({
      sendConfirmationEmail: async () => {
        emailCalls += 1;
      }
    });

    const first = await service.registerForEvent(event.id, {
      name: 'Ada',
      email: 'ada@example.com'
    });

    assert.equal(first.email, 'ada@example.com');
    await assert.rejects(
      service.registerForEvent(event.id, {
        name: 'Grace',
        email: 'grace@example.com'
      }),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, 'CONFLICT');
        assert.equal(error.message, 'Event is full');
        return true;
      }
    );

    const registrations = await registrationRepository.findAllByEventId(event.id);
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].email, 'ada@example.com');
    assert.equal(emailCalls, 1);
  });
});
