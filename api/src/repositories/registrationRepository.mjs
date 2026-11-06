import { Registration } from '../models/index.mjs';

const toPlainRegistration = (registration) => registration?.toJSON() ?? null;

export function countByEventId(eventId) {
  return Registration.count({ where: { eventId } });
}

export async function findByEventIdAndEmail(eventId, email) {
  const registration = await Registration.findOne({ where: { eventId, email } });
  return toPlainRegistration(registration);
}

export async function findAllByEventId(eventId) {
  const registrations = await Registration.findAll({
    where: { eventId },
    order: [['createdAt', 'ASC']]
  });
  return registrations.map(toPlainRegistration);
}

export async function create(data) {
  return toPlainRegistration(await Registration.create(data));
}

export async function createMany(registrations) {
  const createdRegistrations = await Registration.bulkCreate(registrations);
  return createdRegistrations.map(toPlainRegistration);
}
