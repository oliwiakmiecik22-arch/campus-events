import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { Event, Notification, Registration, registerForEvent, registrationEvents } from '../../src/app.mjs';
import { createMcpServer } from '../../src/mcp.mjs';

describe('Campus Events MCP server', () => {
  let client;
  let server;

  beforeEach(async () => {
    await createTestApp();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    server = createMcpServer({ Event, registerForEvent });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('lists upcoming and past events through the MCP tools', async () => {
    await Event.create(validEvent({ title: 'Future event' }));
    await Event.create(validEvent({ title: 'Past event', startsAt: new Date(Date.now() - 86400000) }));

    const tools = await client.listTools();
    const upcoming = await client.callTool({ name: 'get_upcoming_events', arguments: {} });
    const past = await client.callTool({ name: 'get_past_events', arguments: {} });

    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
      'get_past_events', 'get_upcoming_events', 'register_for_event'
    ]);
    assert.deepEqual(JSON.parse(upcoming.content[0].text).map((event) => event.title), ['Future event']);
    assert.deepEqual(JSON.parse(past.content[0].text).map((event) => event.title), ['Past event']);
  });

  it('registers through the shared rules and emits a registration event', async () => {
    const event = await Event.create(validEvent({ capacity: 1 }));
    let notification;
    registrationEvents.once('registered', (data) => { notification = data; });

    const result = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: event.id, name: ' Ada Lovelace ', email: 'ADA@example.com'
    } });

    assert.equal(JSON.parse(result.content[0].text).email, 'ada@example.com');
    assert.equal(notification.registration.eventId, event.id);
    assert.equal(notification.event.title, 'Backend Bootcamp');
    assert.equal(await Notification.count({ where: { type: 'registration' } }), 1);
  });

  it('rejects duplicate and over-capacity registrations', async () => {
    const event = await Event.create(validEvent({ capacity: 1 }));
    const first = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: event.id, name: 'Ada', email: 'ada@example.com'
    } });
    const duplicate = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: event.id, name: 'Ada Again', email: 'ADA@example.com'
    } });
    const full = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: event.id, name: 'Grace', email: 'grace@example.com'
    } });

    assert.equal(first.isError, undefined);
    assert.equal(duplicate.isError, true);
    assert.match(JSON.parse(duplicate.content[0].text).error.message, /already registered/);
    assert.equal(full.isError, true);
    assert.equal(JSON.parse(full.content[0].text).error.message, 'Event is full');
  });

  it('does not allocate the last seat to two simultaneous registrations', async () => {
    const event = await Event.create(validEvent({ capacity: 1 }));
    const registrations = await Promise.all(['ada@example.com', 'grace@example.com'].map((email) =>
      client.callTool({ name: 'register_for_event', arguments: { eventId: event.id, name: 'Student', email } })
    ));

    assert.equal(registrations.filter((result) => !result.isError).length, 1);
    assert.equal(registrations.filter((result) => result.isError).length, 1);
    assert.equal(await Registration.count({ where: { eventId: event.id } }), 1);
  });

  it('validates registration arguments and reports a missing event', async () => {
    const invalid = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: -1, name: 'A', email: 'invalid'
    } });
    assert.equal(invalid.isError, true);

    const missing = await client.callTool({ name: 'register_for_event', arguments: {
      eventId: 999, name: 'Ada', email: 'ada@example.com'
    } });
    assert.equal(missing.isError, true);
    assert.equal(JSON.parse(missing.content[0].text).error.code, 'NOT_FOUND');
  });
});
