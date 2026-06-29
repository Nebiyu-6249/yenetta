import { z } from 'zod';

export const chatScopeSchema = z
  .object({
    subjectId: z.string().optional(),
    chapterId: z.string().optional(),
    grade: z.coerce.number().int().min(9).max(12).optional(),
    year: z.coerce.number().int().min(1990).max(2100).optional(),
    type: z.enum(['curriculum', 'exam_question']).optional(),
  })
  .strict();

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().optional(),
  scope: chatScopeSchema.optional(),
  /** 'am' triggers an Amharic explanation. */
  language: z.enum(['en', 'am']).optional(),
});

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
