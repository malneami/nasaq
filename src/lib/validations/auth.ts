import { z } from 'zod';

export const authSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export type AuthInput = z.infer<typeof authSchema>;
