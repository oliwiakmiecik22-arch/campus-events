import { z } from 'zod';

export const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name (at least 2 characters)').max(100, 'Use at most 100 characters'),
  email: z.email('Enter a valid email address').toLowerCase()
});
