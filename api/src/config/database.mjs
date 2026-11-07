import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from './env.mjs';

const connectionStringSslOptions = [
  'sslcert',
  'sslkey',
  'sslmode',
  'sslrootcert'
];

export function ensureDatabaseDirectory(storage) {
  if (storage !== ':memory:') {
    mkdirSync(path.dirname(storage), { recursive: true });
  }
}

export function createDatabaseConfiguration({ databaseUrl, databaseStorage }) {
  if (databaseUrl) {
    const connectionUrl = new URL(databaseUrl);

    // node-postgres lets URL SSL options replace the verified TLS object below.
    for (const option of connectionStringSslOptions) {
      connectionUrl.searchParams.delete(option);
    }

    return {
      connectionUrl: connectionUrl.toString(),
      options: {
        dialect: 'postgres',
        dialectOptions: {
          ssl: { rejectUnauthorized: true }
        },
        logging: false,
        pool: {
          max: 5,
          min: 0
        }
      }
    };
  }

  ensureDatabaseDirectory(databaseStorage);
  return {
    options: {
      dialect: 'sqlite',
      storage: databaseStorage,
      logging: false
    }
  };
}

export function createSequelize(configuration) {
  if (configuration.connectionUrl) {
    return new Sequelize(configuration.connectionUrl, configuration.options);
  }
  return new Sequelize(configuration.options);
}

const databaseConfiguration = createDatabaseConfiguration(env);
export const sequelize = createSequelize(databaseConfiguration);
