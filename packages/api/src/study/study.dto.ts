import { z } from 'zod';

export const submitQuizSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), answer: z.string() })).min(1),
});

export type SubmitQuizDto = z.infer<typeof submitQuizSchema>;
