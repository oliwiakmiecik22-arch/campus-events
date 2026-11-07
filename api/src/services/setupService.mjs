import { responseCache } from '../cache/responseCache.mjs';
import * as databaseRepository from '../repositories/databaseRepository.mjs';
import * as eventRepository from '../repositories/eventRepository.mjs';
import { seedDemoData } from './demoDataService.mjs';

export async function prepareDatabase() {
  await databaseRepository.syncDatabase();
  if ((await eventRepository.count()) > 0) {
    return false;
  }

  await seedDemoData();
  return true;
}

export async function resetDatabase() {
  await databaseRepository.syncDatabase({ force: true });
  responseCache.clear();
}

export async function resetAndSeedDatabase() {
  await resetDatabase();
  await seedDemoData();
}

export function closeDatabase() {
  return databaseRepository.closeDatabase();
}
