import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDatabaseConfiguration,
  createSequelize
} from '../../src/config/database.mjs';

describe('database configuration', () => {
  it('keeps SQLite for local development and tests', () => {
    const configuration = createDatabaseConfiguration({
      databaseUrl: null,
      databaseStorage: ':memory:'
    });

    assert.equal(configuration.connectionUrl, undefined);
    assert.equal(configuration.options.dialect, 'sqlite');
    assert.equal(configuration.options.storage, ':memory:');
  });

  it('uses the Sequelize PostgreSQL dialect with verified TLS', async () => {
    const configuration = createDatabaseConfiguration({
      databaseUrl: [
        'postgresql://campus:secret@example.neon.tech/campus',
        '?sslmode=require&channel_binding=require'
      ].join(''),
      databaseStorage: ':memory:'
    });

    const connectionUrl = new URL(configuration.connectionUrl);
    assert.equal(configuration.options.dialect, 'postgres');
    assert.equal(configuration.options.dialectOptions.ssl.rejectUnauthorized, true);
    assert.equal(connectionUrl.searchParams.has('sslmode'), false);
    assert.equal(connectionUrl.searchParams.get('channel_binding'), 'require');

    const postgres = createSequelize(configuration);
    try {
      assert.equal(postgres.getDialect(), 'postgres');
    } finally {
      await postgres.close();
    }
  });
});
