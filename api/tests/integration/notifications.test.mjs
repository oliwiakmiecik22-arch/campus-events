import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { addNotificationClient, Notification, pollNotifications } from '../../src/app.mjs';

describe('SSE notifications', () => {
  let app;
  let disconnect;
  let tabs;

  beforeEach(async () => {
    ({ app } = await createTestApp());
    tabs = [];
    disconnect = [];
  });

  afterEach(async () => {
    for (const close of disconnect) close();
  });

  function connectTab() {
    const tab = { frames: [], write(frame) { this.frames.push(frame); } };
    tabs.push(tab);
    disconnect.push(addNotificationClient(tab, 0));
    return tab;
  }

  function notification(tab, index) {
    const frame = tab.frames[index];
    assert.match(frame, /^id: \d+\nevent: notification\ndata: /);
    return JSON.parse(frame.match(/data: ([^\n]+)/)[1]);
  }

  it('broadcasts safe event and successful registration notices to every open tab once', async () => {
    const firstTab = await connectTab();
    const secondTab = await connectTab();
    const created = await request(app).post('/api/events').send(validEvent({ capacity: 1 }));
    assert.equal(created.status, 201);

    await pollNotifications();
    const firstEventNotice = notification(firstTab, 0);
    const secondEventNotice = notification(secondTab, 0);
    assert.deepEqual(firstEventNotice, { type: 'event_created', message: 'New event: Backend Bootcamp' });
    assert.deepEqual(secondEventNotice, firstEventNotice);

    const registrationUrl = `/api/events/${created.body.id}/registrations`;
    const success = await request(app).post(registrationUrl).send({ name: 'Private Name', email: 'private@example.com' });
    await pollNotifications();
    const firstRegistrationNotice = notification(firstTab, 1);
    const secondRegistrationNotice = notification(secondTab, 1);
    assert.equal(success.status, 201);
    assert.deepEqual(firstRegistrationNotice, { type: 'registration', message: 'Someone registered for Backend Bootcamp' });
    assert.deepEqual(secondRegistrationNotice, firstRegistrationNotice);
    assert.doesNotMatch(JSON.stringify(firstRegistrationNotice), /Private Name|private@example\.com/);

    const duplicate = await request(app).post(registrationUrl).send({ name: 'Private Name', email: 'private@example.com' });
    await pollNotifications();
    assert.equal(duplicate.status, 409);
    assert.equal(await Notification.count(), 2);
    assert.equal(firstTab.frames.length, 2);
    assert.equal(secondTab.frames.length, 2);
  });
});
