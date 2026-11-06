import { Router } from 'express';
import * as eventController from '../controllers/eventController.mjs';
import * as registrationController from '../controllers/registrationController.mjs';
import { validate } from '../middleware/validate.mjs';
import { idSchema } from '../validation/commonSchemas.mjs';
import { createEventSchema, updateEventSchema } from '../validation/eventSchemas.mjs';
import { registrationSchema } from '../validation/registrationSchemas.mjs';

export const eventRouter = Router();

eventRouter.get('/', eventController.listEvents);
eventRouter.get('/:id', validate({ params: idSchema }), eventController.getEvent);
eventRouter.post('/', validate({ body: createEventSchema }), eventController.createEvent);
eventRouter.patch(
  '/:id',
  validate({ params: idSchema, body: updateEventSchema }),
  eventController.updateEvent
);
eventRouter.delete('/:id', validate({ params: idSchema }), eventController.deleteEvent);
eventRouter.get(
  '/:id/registrations',
  validate({ params: idSchema }),
  registrationController.listRegistrations
);
eventRouter.post(
  '/:id/registrations',
  validate({ params: idSchema, body: registrationSchema }),
  registrationController.createRegistration
);
