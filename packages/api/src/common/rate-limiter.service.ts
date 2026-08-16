import { Injectable } from '@nestjs/common';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Fixed-window rate limiter (SECURITY.md section 8). In-memory by default so it
 * works with zero infra; for multi-instance deployments swap the store for
 * Redis (the `consume` contract stays the same). Enforced per key = route + IP.
 */
@Injectable()
export class RateLimiterService {
  private readonly store = new Map<string, { count: number; resetAt: number }>();
  private readonly maxKeys = 50_000;

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    if (this.store.size > this.maxKeys) this.prune(now);

    const entry = this.store.get(key);
    if (!entry || entry.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
    }
    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
    }
    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count, resetInMs: entry.resetAt - now };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.store) {
      if (entry.resetAt <= now) this.store.delete(key);
    }
  }
}
