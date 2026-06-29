import { z } from 'zod';

export const practiceQuerySchema = z.object({
  subjectId: z.string().optional(),
  chapterId: z.string().optional(),
  paperId: z.string().optional(),
  year: z.coerce.number().int().optional(),
});
export type PracticeQueryDto = z.infer<typeof practiceQuerySchema>;

const answers = z.array(z.object({ questionId: z.string(), answer: z.string() })).min(1);

export const submitPracticeSchema = z.object({ answers });
export type SubmitPracticeDto = z.infer<typeof submitPracticeSchema>;

export const submitMockSchema = z.object({
  answers,
  durationSeconds: z.coerce.number().int().nonnegative(),
});
export type SubmitMockDto = z.infer<typeof submitMockSchema>;
