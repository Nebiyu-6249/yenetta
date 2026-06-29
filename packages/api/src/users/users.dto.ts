import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    grade: z.union([z.literal(9), z.literal(10), z.literal(11), z.literal(12)]).optional(),
    stream: z.enum(['natural', 'social', 'both']).optional(),
    locale: z.enum(['en', 'am']).optional(),
  })
  .strict();

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
