import { z } from 'zod';

export const voucherSchema = z.object({
  code: z.string().trim().min(3).max(64),
});

export type VoucherDto = z.infer<typeof voucherSchema>;
