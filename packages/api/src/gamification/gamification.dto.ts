import { z } from 'zod';

export const optInSchema = z.object({ optIn: z.boolean() });
export type OptInDto = z.infer<typeof optInSchema>;
