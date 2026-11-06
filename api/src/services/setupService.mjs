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

export function resetDatabase() {
  return databaseRepository.syncDatabase({ force: true });
}

export async function resetAndSeedDatabase() {
  await resetDatabase();
  await seedDemoData();
}

export function closeDatabase() {
  return databaseRepository.closeDatabase();
}
