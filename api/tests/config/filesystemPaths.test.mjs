import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ensureDatabaseDirectory } from '../../src/config/database.mjs';
import {
  apiDirectory,
  resolveDatabaseStorage
} from '../../src/config/paths.mjs';

describe('filesystem paths', () => {
  let originalDirectory;
  let temporaryDirectory;

  before(async () => {
    originalDirectory = process.cwd();
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'campus-events-paths-'));
    process.chdir(temporaryDirectory);
  });

  after(async () => {
    process.chdir(originalDirectory);
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('resolves storage from the API directory and creates its parent', async () => {
    assert.equal(
      resolveDatabaseStorage('./data/events.sqlite'),
      path.join(apiDirectory, 'data', 'events.sqlite')
    );

    const storage = path.join(temporaryDirectory, 'persistent', 'nested', 'events.sqlite');
    ensureDatabaseDirectory(storage);

    assert.equal((await stat(path.dirname(storage))).isDirectory(), true);
  });
});
