import { describe, expect, it } from 'vitest';
import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  it('allows up to the limit within a window, then blocks', () => {
    const rl = new RateLimiterService();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(rl.consume('k', 5, 60_000, now).allowed).toBe(true);
    }
    const blocked = rl.consume('k', 5, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetInMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiterService();
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) rl.consume('k', 5, 60_000, start);
    expect(rl.consume('k', 5, 60_000, start).allowed).toBe(false);
    // After the window, the counter resets.
    expect(rl.consume('k', 5, 60_000, start + 60_001).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const rl = new RateLimiterService();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) rl.consume('a', 5, 60_000, now);
    expect(rl.consume('a', 5, 60_000, now).allowed).toBe(false);
    // A different key (e.g. different IP) is unaffected.
    expect(rl.consume('b', 5, 60_000, now).allowed).toBe(true);
  });

  it('reports remaining count', () => {
    const rl = new RateLimiterService();
    const now = 1_000_000;
    expect(rl.consume('k', 3, 1000, now).remaining).toBe(2);
    expect(rl.consume('k', 3, 1000, now).remaining).toBe(1);
    expect(rl.consume('k', 3, 1000, now).remaining).toBe(0);
  });
});
