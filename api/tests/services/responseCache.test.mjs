import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MemoryCache } from '../../src/cache/responseCache.mjs';
import * as eventRepository from '../../src/repositories/eventRepository.mjs';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent
} from '../../src/services/eventService.mjs';
import {
  createRegistrationService,
  listRegistrations
} from '../../src/services/registrationService.mjs';
import { resetDatabase } from '../../src/services/setupService.mjs';
import { createStatsService, getStats } from '../../src/services/statsService.mjs';

const eventData = (overrides = {}) => ({
  title: 'Backend Bootcamp',
  description: 'Learn the API basics.',
  location: 'Room C101',
  startsAt: new Date('2030-05-20T12:00:00.000Z'),
  capacity: 10,
  ...overrides
});

describe('memory response cache', () => {
  it('reuses a value until its TTL expires', async () => {
    let now = 1000;
    let loadCalls = 0;
    const cache = new MemoryCache({ ttlMs: 100, now: () => now });
    const load = async () => {
      loadCalls += 1;
      return `value-${loadCalls}`;
    };

    assert.equal(await cache.getOrLoad('key', load), 'value-1');
    assert.equal(await cache.getOrLoad('key', load), 'value-1');
    assert.equal(loadCalls, 1);

    now += 101;
    assert.equal(await cache.getOrLoad('key', load), 'value-2');
    assert.equal(loadCalls, 2);
  });

  it('keeps a bounded number of entries', async () => {
    const cache = new MemoryCache({ maxEntries: 2 });

    await cache.getOrLoad('first', async () => 1);
    await cache.getOrLoad('second', async () => 2);
    await cache.getOrLoad('third', async () => 3);

    assert.equal(cache.size, 2);
    assert.equal(cache.get('first').hit, false);
  });

  it('does not cache errors', async () => {
    const cache = new MemoryCache();
    let loadCalls = 0;

    await assert.rejects(cache.getOrLoad('key', async () => {
      loadCalls += 1;
      throw new Error('load failed');
    }));
    assert.equal(await cache.getOrLoad('key', async () => {
      loadCalls += 1;
      return 'recovered';
    }), 'recovered');
    assert.equal(loadCalls, 2);
  });

  it('does not store an in-flight read after invalidation', async () => {
    const cache = new MemoryCache();
    let finishLoad;
    const loading = cache.getOrLoad('event', () => new Promise((resolve) => {
      finishLoad = resolve;
    }));

    cache.invalidate('event');
    finishLoad('stale event');

    assert.equal(await loading, 'stale event');
    assert.equal(cache.get('event').hit, false);
  });
});

describe('cached API services', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns current data after event creation, update and deletion', async () => {
    assert.deepEqual(await listEvents(), []);

    const event = await createEvent(eventData());
    assert.deepEqual((await listEvents()).map((item) => item.title), ['Backend Bootcamp']);

    await getEvent(event.id);
    await getStats();
    await listRegistrations(event.id);
    await updateEvent(event.id, { title: 'Updated Bootcamp', capacity: 20 });

    assert.equal((await getEvent(event.id)).title, 'Updated Bootcamp');
    assert.equal((await listEvents())[0].title, 'Updated Bootcamp');
    assert.equal((await getStats())[0].title, 'Updated Bootcamp');

    await deleteEvent(event.id);

    assert.deepEqual(await listEvents(), []);
    assert.deepEqual(await getStats(), []);
    await assert.rejects(getEvent(event.id), (error) => error.code === 'NOT_FOUND');
    await assert.rejects(
      listRegistrations(event.id),
      (error) => error.code === 'NOT_FOUND'
    );
  });

  it('invalidates registration data before waiting for email delivery', async () => {
    const event = await createEvent(eventData());
    await getEvent(event.id);
    await listRegistrations(event.id);
    await getStats();

    let signalEmailStarted;
    let finishEmail;
    const emailStarted = new Promise((resolve) => {
      signalEmailStarted = resolve;
    });
    const emailPending = new Promise((resolve) => {
      finishEmail = resolve;
    });
    const service = createRegistrationService({
      sendConfirmationEmail: async () => {
        signalEmailStarted();
        await emailPending;
      }
    });
    const registrationPending = service.registerForEvent(event.id, {
      name: 'Ada',
      email: 'ada@example.com'
    });

    await emailStarted;
    try {
      assert.equal((await getEvent(event.id)).registered, 1);
      assert.deepEqual(
        (await listRegistrations(event.id)).map((registration) => registration.email),
        ['ada@example.com']
      );
      assert.equal((await getStats())[0].registered, 1);
    } finally {
      finishEmail();
    }

    await registrationPending;
  });

  it('expires stats when an event becomes past', async () => {
    let now = Date.parse('2030-05-20T11:59:59.900Z');
    const startsAt = new Date(now + 100);
    await eventRepository.create(eventData({ startsAt }));
    const cache = new MemoryCache({ now: () => now });
    const statsService = createStatsService({ cache, now: () => now });

    assert.equal((await statsService.getStats())[0].status, 'open');

    now += 101;
    assert.equal((await statsService.getStats())[0].status, 'past');
  });
});
