import { z } from 'zod';

// These messages are shown in the frontend, so keep them human-friendly.
export const createEventSchema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters').max(120, 'Use at most 120 characters'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters').optional(),
  location: z.string().trim().min(2, 'Enter a location').max(120, 'Use at most 120 characters'),
  startsAt: z.coerce.date({ error: 'Pick a date and time' }),
  capacity: z.number({ error: 'Enter a number of seats' }).int('Use a whole number').min(1, 'At least 1 seat').max(10000, 'At most 10 000 seats')
});

export const updateEventSchema = createEventSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });
