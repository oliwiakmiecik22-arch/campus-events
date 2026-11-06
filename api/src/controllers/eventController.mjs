import * as eventService from '../services/eventService.mjs';

export async function listEvents(_req, res) {
  res.json(await eventService.listEvents());
}

export async function getEvent(req, res) {
  const event = await eventService.getEvent(req.validated.params.id);
  res.status(200).json(event);
}

export async function createEvent(req, res) {
  const event = await eventService.createEvent(req.validated.body);
  res.status(201).location(`/api/events/${event.id}`).json(event);
}

export async function updateEvent(req, res) {
  const event = await eventService.updateEvent(
    req.validated.params.id,
    req.validated.body
  );
  res.status(200).json(event);
}

export async function deleteEvent(req, res) {
  await eventService.deleteEvent(req.validated.params.id);
  res.status(204).send();
}
