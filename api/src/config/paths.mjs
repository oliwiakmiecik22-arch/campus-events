import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export const apiDirectory = path.resolve(configDirectory, '../..');
export const projectDirectory = path.resolve(apiDirectory, '..');
export const envFilePath = path.join(apiDirectory, '.env');
export const frontendDistDirectory = path.join(projectDirectory, 'web', 'dist');

export function resolveDatabaseStorage(storage) {
  if (storage === ':memory:') {
    return storage;
  }
  return path.isAbsolute(storage) ? path.normalize(storage) : path.resolve(apiDirectory, storage);
}
