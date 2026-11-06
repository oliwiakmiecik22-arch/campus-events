import * as registrationService from '../services/registrationService.mjs';

export async function listRegistrations(req, res) {
  const registrations = await registrationService.listRegistrations(
    req.validated.params.id
  );
  res.json(registrations);
}

export async function createRegistration(req, res) {
  const registration = await registrationService.registerForEvent(
    req.validated.params.id,
    req.validated.body
  );
  res.status(201).json(registration);
}
