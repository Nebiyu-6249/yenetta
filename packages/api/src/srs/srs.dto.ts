import { z } from 'zod';

export const reviewSchema = z.object({
  flashcardId: z.string().min(1),
  grade: z.coerce.number().int().min(0).max(5),
});

export type ReviewDto = z.infer<typeof reviewSchema>;
