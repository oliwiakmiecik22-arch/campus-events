// Campus Events API
//
// Everything lives in this one file: settings, database, validation, routes and error handling.
// It works, and tests/integration proves it. It is also hard to read, hard to test and
// hard to change safely. Part 1 of the assignment: find out why, then split it into layers.

import express from 'express';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { DataTypes, Op, Sequelize, Transaction } from 'sequelize';
import { createLogger, format, transports } from 'winston';
import { z } from 'zod';
import { env } from './config/env.mjs';
import { registerMcpHttpRoute } from './mcp-http.mjs';

const logger = createLogger({
  level: env.logLevel,
  silent: env.nodeEnv === 'test',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()]
});

// ---------------------------------------------------------------- database

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: env.dbStorage,
  logging: false
});

export const Event = sequelize.define('Event', {
  title: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING(120), allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  capacity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } }
});

export const Registration = sequelize.define('Registration', {
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false }
}, { indexes: [{ unique: true, fields: ['eventId', 'email'] }] });

export const Notification = sequelize.define('Notification', {
  type: { type: DataTypes.STRING(30), allowNull: false },
  eventTitle: { type: DataTypes.STRING(120), allowNull: false }
});

export const registrationEvents = new EventEmitter();

Event.hasMany(Registration, { foreignKey: { name: 'eventId', allowNull: false }, onDelete: 'CASCADE' });
Registration.belongsTo(Event, { foreignKey: 'eventId' });

// ---------------------------------------------------------------- validation

const idSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Messages are shown to end users in the frontend, so keep them human.
const createEventSchema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters').max(120, 'Use at most 120 characters'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters').optional(),
  location: z.string().trim().min(2, 'Enter a location').max(120, 'Use at most 120 characters'),
  startsAt: z.coerce.date({ error: 'Pick a date and time' }),
  capacity: z.number({ error: 'Enter a number of seats' }).int('Use a whole number').min(1, 'At least 1 seat').max(10000, 'At most 10 000 seats')
});

const updateEventSchema = createEventSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name (at least 2 characters)').max(100, 'Use at most 100 characters'),
  email: z.email('Enter a valid email address').toLowerCase()
});

let registrationQueue = Promise.resolve();

async function createRegistration(eventId, data) {
  const outcome = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (transaction) => {
    const event = await Event.findByPk(eventId, { transaction });
    if (!event) {
      return { status: 404, error: { code: 'NOT_FOUND', message: `Event with id ${eventId} not found` } };
    }

    const existing = await Registration.findOne({ where: { eventId: event.id, email: data.email }, transaction });
    if (existing) {
      return { status: 409, error: { code: 'CONFLICT', message: `${data.email} is already registered for this event` } };
    }

    const count = await Registration.count({ where: { eventId: event.id }, transaction });
    if (count >= event.capacity) {
      return { status: 409, error: { code: 'CONFLICT', message: 'Event is full' } };
    }

    const registration = await Registration.create({ eventId: event.id, name: data.name, email: data.email }, { transaction });
    await Notification.create({ type: 'registration', eventTitle: event.title }, { transaction });
    return { status: 201, registration: registration.toJSON(), event: event.toJSON() };
  });

  if (outcome.error) return outcome;
  registrationEvents.emit('registered', { event: outcome.event, registration: outcome.registration });
  logger.info('new registration for ' + outcome.event.title + ': ' + outcome.registration.name + ' <' + outcome.registration.email + '>');
  return { status: outcome.status, registration: outcome.registration };
}

export function registerForEvent(eventId, data) {
  const pending = registrationQueue.then(() => createRegistration(eventId, data));
  registrationQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

// ---------------------------------------------------------------- app

export const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - start)
    });
  });
  next();
});

app.get('/api/health', async (req, res) => {
  await sequelize.authenticate();
  res.status(200).json({ status: 'ok' });
});

const notificationClients = new Set();
let notificationPoll;
let notificationHeartbeat;

function sendNotification(client, notification) {
  if (client.lastId >= notification.id) return;
  const payload = {
    type: notification.type,
    message: notification.type === 'registration'
      ? `Someone registered for ${notification.eventTitle}`
      : `New event: ${notification.eventTitle}`
  };
  client.response.write(`id: ${notification.id}\nevent: notification\ndata: ${JSON.stringify(payload)}\n\n`);
  client.lastId = notification.id;
}

export async function pollNotifications() {
  if (notificationClients.size === 0) return;
  try {
    const lastIds = [...notificationClients].map((client) => client.lastId);
    const notifications = await Notification.findAll({
      where: { id: { [Op.gt]: Math.min(...lastIds) } },
      order: [['id', 'ASC']],
      limit: 100
    });

    for (const notification of notifications) {
      for (const client of notificationClients) sendNotification(client, notification);
    }
  } catch (err) {
    logger.error('notification stream poll failed', { message: err.message });
  }
}

export function addNotificationClient(response, lastId) {
  const client = { response, lastId };
  notificationClients.add(client);
  if (!notificationPoll) notificationPoll = setInterval(pollNotifications, 500);
  if (!notificationHeartbeat) {
    notificationHeartbeat = setInterval(() => {
      for (const openClient of notificationClients) openClient.response.write(': heartbeat\n\n');
    }, 15000);
  }
  return () => {
    notificationClients.delete(client);
    if (notificationClients.size === 0) {
      clearInterval(notificationPoll);
      notificationPoll = undefined;
      clearInterval(notificationHeartbeat);
      notificationHeartbeat = undefined;
    }
  };
}

app.get('/api/events/stream', async (req, res) => {
  const requestedId = Number(req.get('Last-Event-ID'));
  const lastId = Number.isSafeInteger(requestedId) && requestedId >= 0
    ? requestedId
    : (await Notification.max('id') || 0);

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  const removeClient = addNotificationClient(res, lastId);
  res.on('close', removeClient);
});

app.get('/api/events', async (req, res) => {
  const events = await Event.findAll({ order: [['startsAt', 'ASC']] });
  res.json(events);
});

app.get('/api/events/:id', async (req, res) => {
  const p = idSchema.safeParse(req.params);
  if (!p.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: p.error.issues.map((i) => ({ field: i.path.join('.') || 'params', message: i.message }))
      }
    });
  }

  const ev = await Event.findByPk(p.data.id);
  if (!ev) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Event with id ${p.data.id} not found` } });
  }

  const count = await Registration.count({ where: { eventId: ev.id } });
  res.status(200).json({ ...ev.toJSON(), registered: count, spotsLeft: Math.max(ev.capacity - count, 0) });
});

app.post('/api/events', async (req, res) => {
  const result = createEventSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }))
      }
    });
  }

  const event = await sequelize.transaction(async (transaction) => {
    const created = await Event.create(result.data, { transaction });
    await Notification.create({ type: 'event_created', eventTitle: created.title }, { transaction });
    return created;
  });
  res.status(201).location('/api/events/' + event.id).json(event);
});

app.patch('/api/events/:id', async (req, res, next) => {
  try {
    const p = idSchema.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: p.error.issues.map((i) => ({ field: i.path.join('.') || 'params', message: i.message }))
        }
      });
    }
    const b = updateEventSchema.safeParse(req.body);
    if (!b.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: b.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }))
        }
      });
    }

    const event = await Event.findByPk(p.data.id);
    if (!event) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Event with id ${p.data.id} not found` } });
    }
    await event.update(b.data);
    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/events/:id', async (req, res) => {
  const p = idSchema.safeParse(req.params);
  if (!p.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: p.error.issues.map((i) => ({ field: i.path.join('.') || 'params', message: i.message }))
      }
    });
  }

  const deleted = await Event.destroy({ where: { id: p.data.id } });
  if (deleted === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Event with id ${p.data.id} not found` } });
  }
  res.status(204).send();
});

app.get('/api/events/:id/registrations', async (req, res) => {
  const p = idSchema.safeParse(req.params);
  if (!p.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: p.error.issues.map((i) => ({ field: i.path.join('.') || 'params', message: i.message }))
      }
    });
  }

  const ev = await Event.findByPk(p.data.id);
  if (!ev) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Event with id ${p.data.id} not found` } });
  }
  const registrations = await Registration.findAll({ where: { eventId: ev.id }, order: [['createdAt', 'ASC']] });
  res.json(registrations);
});

app.post('/api/events/:id/registrations', async (req, res, next) => {
  try {
    const p = idSchema.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: p.error.issues.map((i) => ({ field: i.path.join('.') || 'params', message: i.message }))
        }
      });
    }
    const data = registrationSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: data.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }))
        }
      });
    }

    const result = await registerForEvent(p.data.id, data.data);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json(result.registration);
  } catch (err) {
    next(err);
  }
});

app.get('/api/stats', async (req, res) => {
  const events = await Event.findAll();
  const result = [];
  for (let i = 0; i < events.length; i++) {
    const regs = await Registration.findAll({ where: { eventId: events[i].id } });
    let pct = 0;
    if (events[i].capacity > 0) {
      pct = Math.round((regs.length / events[i].capacity) * 100);
    }
    let status = 'open';
    if (regs.length >= events[i].capacity) {
      status = 'full';
    } else if (new Date(events[i].startsAt) < new Date()) {
      status = 'past';
    }
    result.push({
      id: events[i].id,
      title: events[i].title,
      registered: regs.length,
      capacity: events[i].capacity,
      occupancy: pct + '%',
      status: status
    });
  }
  res.json(result);
});

registerMcpHttpRoute(app, { Event, registerForEvent }, env.mcpAuthToken);

if (env.nodeEnv === 'production') {
  const frontendPath = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.use(express.static(frontendPath, { index: false }));
  app.get('/{*path}', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.sendFile(fileURLToPath(new URL('../../web/dist/index.html', import.meta.url)), (err) => {
      if (err) next(err);
    });
  });
}

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` } });
});

// Express recognises an error handler by its FOUR parameters.
app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
});

// ---------------------------------------------------------------- demo data

const inDays = (days, hour = 14) => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export async function seedDemoData() {
  await Event.bulkCreate([
    {
      title: 'Welcome Day IXD',
      description: 'Meet your classmates, lecturers and the projects of this year.',
      location: 'Campus Mechelen',
      startsAt: inDays(7, 10),
      capacity: 120
    },
    {
      title: 'Prototyping with Figma & APIs',
      description: 'Connect a clickable prototype to real data in one afternoon.',
      location: 'Room B204',
      startsAt: inDays(14),
      capacity: 25
    },
    {
      title: 'Backend Bootcamp',
      description: 'A small, hands-on session. Only two seats, so be quick.',
      location: 'Room C101',
      startsAt: inDays(21),
      capacity: 2
    },
    {
      title: 'Portfolio Review',
      description: 'Get feedback on your portfolio from industry guests.',
      location: 'Online',
      startsAt: inDays(-10),
      capacity: 40
    }
  ]);

  await Registration.bulkCreate([
    { eventId: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    { eventId: 1, name: 'Grace Hopper', email: 'grace@example.com' },
    { eventId: 2, name: 'Alan Turing', email: 'alan@example.com' }
  ]);
}
