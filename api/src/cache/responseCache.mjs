export const RESPONSE_CACHE_TTL_MS = 5000;
export const RESPONSE_CACHE_MAX_ENTRIES = 100;

export const responseCacheKeys = {
  eventList: 'events:list',
  event: (eventId) => `events:${eventId}`,
  registrations: (eventId) => `events:${eventId}:registrations`,
  stats: 'stats'
};

export class MemoryCache {
  constructor({
    ttlMs = RESPONSE_CACHE_TTL_MS,
    maxEntries = RESPONSE_CACHE_MAX_ENTRIES,
    now = Date.now
  } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
    this.generation = 0;
  }

  get size() {
    return this.entries.size;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return { hit: false };
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return { hit: false };
    }

    // Reinsert a hit so the oldest unused entry is evicted first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { hit: true, value: entry.value };
  }

  async getOrLoad(key, load, ttlMs = this.ttlMs) {
    return this.getOrLoadWithTtl(key, async () => ({
      value: await load(),
      ttlMs
    }));
  }

  async getOrLoadWithTtl(key, load) {
    const cached = this.get(key);
    if (cached.hit) {
      return cached.value;
    }

    const generation = this.generation;
    const { value, ttlMs } = await load();
    this.setIfCurrent(key, value, ttlMs, generation);
    return value;
  }

  setIfCurrent(key, value, ttlMs, generation) {
    if (generation !== this.generation || ttlMs <= 0) {
      return;
    }

    const now = this.now();
    for (const [storedKey, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(storedKey);
      }
    }

    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: now + ttlMs });
  }

  invalidate(...keys) {
    // Advancing the generation prevents reads already in flight from storing stale data.
    this.generation += 1;
    for (const key of keys) {
      this.entries.delete(key);
    }
  }

  clear() {
    this.generation += 1;
    this.entries.clear();
  }
}

export const responseCache = new MemoryCache();
