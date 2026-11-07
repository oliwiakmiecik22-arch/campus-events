import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../../src/app.mjs';

describe('production static serving', () => {
  let app;
  let frontendDirectory;

  before(async () => {
    frontendDirectory = await mkdtemp(path.join(tmpdir(), 'campus-events-web-'));
    await mkdir(path.join(frontendDirectory, 'assets'));
    await writeFile(
      path.join(frontendDirectory, 'index.html'),
      '<!doctype html><html><body>Campus Events SPA</body></html>'
    );
    await writeFile(
      path.join(frontendDirectory, 'assets', 'app.js'),
      'globalThis.campusEventsLoaded = true;'
    );
    app = createApp({ serveFrontend: true, frontendDirectory });
  });

  after(async () => {
    await rm(frontendDirectory, { recursive: true, force: true });
  });

  it('serves built frontend assets', async () => {
    const response = await request(app).get('/assets/app.js');

    assert.equal(response.status, 200);
    assert.match(response.text, /campusEventsLoaded/);
  });

  it('serves index.html for Vue Router history routes', async () => {
    const response = await request(app).get('/events/42');

    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.match(response.text, /Campus Events SPA/);
  });

  it('keeps unknown API routes as JSON 404 responses', async () => {
    const response = await request(app).get('/api/does-not-exist');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/does-not-exist not found'
      }
    });
  });
});
