import { z } from 'zod';

export const generatePlanSchema = z.object({
  examDate: z.coerce.date(),
  dailyMinutes: z.coerce.number().int().min(15).max(600).default(60),
});

export type GeneratePlanDto = z.infer<typeof generatePlanSchema>;
