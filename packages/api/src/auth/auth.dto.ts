import { z } from 'zod';

// Lenient phone validation for MVP: optional leading +, 9–15 digits.
// (Ethiopian MSISDNs like +2519XXXXXXXX fit; normalization can tighten later.)
const phone = z
  .string()
  .trim()
  .regex(/^\+?\d{9,15}$/, 'Enter a valid phone number');

export const requestOtpSchema = z.object({ phone });
export type RequestOtpDto = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

// A TOTP authentication code (6 digits), used for MFA verify/enroll/disable.
const totpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Code must be 6 digits');

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(10),
  code: totpCode,
});
export type MfaVerifyDto = z.infer<typeof mfaVerifySchema>;

export const mfaCodeSchema = z.object({ code: totpCode });
export type MfaCodeDto = z.infer<typeof mfaCodeSchema>;
