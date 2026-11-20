import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { Event } from '../../src/app.mjs';

const testToken = process.env.MCP_AUTH_TOKEN;

describe('Remote MCP HTTP endpoint', () => {
  let app;
  let server;
  let baseUrl;
  let client;

  beforeEach(async () => {
    ({ app } = await createTestApp());
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await client?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  it('requires a bearer token and serves tools over Streamable HTTP', async () => {
    const unauthorized = await fetch(`${baseUrl}/mcp`);
    assert.equal(unauthorized.status, 401);

    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${testToken}` } }
    });
    client = new Client({ name: 'campus-events-http-test', version: '1.0.0' });
    await client.connect(transport);

    const toolNames = (await client.listTools()).tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, ['get_past_events', 'get_upcoming_events', 'register_for_event']);

    const event = await Event.create(validEvent({ capacity: 1 }));
    const registration = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: event.id, name: 'External MCP User', email: 'external-mcp@example.com'
    } });
    assert.equal(registration.isError, undefined);
    assert.equal(JSON.parse(registration.content[0].text).eventId, event.id);
  });
});
