import {
  RESPONSE_CACHE_TTL_MS,
  responseCache,
  responseCacheKeys
} from '../cache/responseCache.mjs';
import * as eventRepository from '../repositories/eventRepository.mjs';
import * as registrationRepository from '../repositories/registrationRepository.mjs';

function getStatus(event, registrationCount, now) {
  if (registrationCount >= event.capacity) {
    return 'full';
  }
  if (new Date(event.startsAt).getTime() < now) {
    return 'past';
  }
  return 'open';
}

function getStatsTtl(events, now) {
  const nextTransition = events
    .map((event) => new Date(event.startsAt).getTime())
    .filter((startsAt) => startsAt >= now)
    .sort((first, second) => first - second)[0];

  if (nextTransition === undefined) {
    return RESPONSE_CACHE_TTL_MS;
  }
  return Math.min(RESPONSE_CACHE_TTL_MS, nextTransition - now + 1);
}

async function loadStats(now) {
  const events = await eventRepository.findAll();
  const registrationsByEvent = [];

  for (const event of events) {
    const registrations = await registrationRepository.findAllByEventId(event.id);
    registrationsByEvent.push({ event, registrationCount: registrations.length });
  }

  const calculatedAt = now();
  const result = registrationsByEvent.map(({ event, registrationCount }) => {
    let occupancy = 0;
    if (event.capacity > 0) {
      occupancy = Math.round((registrationCount / event.capacity) * 100);
    }

    return {
      id: event.id,
      title: event.title,
      registered: registrationCount,
      capacity: event.capacity,
      occupancy: `${occupancy}%`,
      status: getStatus(event, registrationCount, calculatedAt)
    };
  });

  return {
    value: result,
    ttlMs: getStatsTtl(events, calculatedAt)
  };
}

export function createStatsService({ cache = responseCache, now = Date.now } = {}) {
  return {
    getStats() {
      return cache.getOrLoadWithTtl(
        responseCacheKeys.stats,
        () => loadStats(now)
      );
    }
  };
}

const statsService = createStatsService();
export const getStats = statsService.getStats;
