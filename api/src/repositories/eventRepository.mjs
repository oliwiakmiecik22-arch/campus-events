import { Event } from '../models/index.mjs';

const toPlainEvent = (event) => event?.toJSON() ?? null;

export async function findAllByStartDate() {
  const events = await Event.findAll({ order: [['startsAt', 'ASC']] });
  return events.map(toPlainEvent);
}

export async function findAll() {
  const events = await Event.findAll();
  return events.map(toPlainEvent);
}

export async function findById(id) {
  return toPlainEvent(await Event.findByPk(id));
}

export async function create(data) {
  return toPlainEvent(await Event.create(data));
}

export async function updateById(id, data) {
  const event = await Event.findByPk(id);
  if (!event) {
    return null;
  }

  await event.update(data);
  return toPlainEvent(event);
}

export function deleteById(id) {
  return Event.destroy({ where: { id } });
}

export function count() {
  return Event.count();
}

export async function createMany(events) {
  const createdEvents = await Event.bulkCreate(events);
  return createdEvents.map(toPlainEvent);
}
