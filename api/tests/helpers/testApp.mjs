import { app } from '../../src/app.mjs';
import { resetDatabase } from '../../src/services/setupService.mjs';

// .env.test sets DB_STORAGE=:memory:, so the tests never touch real data.
// Every call empties all tables: tests never share state.
export async function createTestApp() {
  await resetDatabase();
  return { app };
}

export const validEvent = (overrides = {}) => ({
  title: 'Backend Bootcamp',
  location: 'Room C101',
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  capacity: 10,
  ...overrides
});
