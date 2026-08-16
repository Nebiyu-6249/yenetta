import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional stable key prefix (defaults to Controller.handler). */
  key?: string;
}

/** Applies a per-route + per-IP rate limit (enforced by RateLimitGuard). */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
