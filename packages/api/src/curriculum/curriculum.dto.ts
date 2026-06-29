import { z } from 'zod';

export const subjectQuerySchema = z.object({
  grade: z.coerce.number().int().min(9).max(12).optional(),
  stream: z.enum(['natural', 'social', 'both']).optional(),
});

export type SubjectQueryDto = z.infer<typeof subjectQuerySchema>;
