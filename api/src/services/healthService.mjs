import * as databaseRepository from '../repositories/databaseRepository.mjs';

export function checkHealth() {
  return databaseRepository.authenticate();
}
