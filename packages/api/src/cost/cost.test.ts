import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ModelRouter } from './model-router';
import { estimateCost } from './pricing';
import { UsageService } from './usage.service';

describe('estimateCost', () => {
  it('prices known models and treats stub models as free', () => {
    expect(estimateCost('gpt-4o-mini', 1_000_000, 0)).toBeCloseTo(0.15, 6);
    expect(estimateCost('gpt-4o-mini', 0, 1_000_000)).toBeCloseTo(0.6, 6);
    expect(estimateCost('stub-cheap', 1000, 1000)).toBe(0);
  });
});

describe('ModelRouter', () => {
  const router = new ModelRouter();
  it('defaults to cheap and escalates only when needed', () => {
    expect(router.tierForTask('chat')).toBe('cheap');
    expect(router.tierForTask('summary')).toBe('cheap');
    expect(router.tierForTask('quiz')).toBe('standard');
    expect(router.tierForTask('deep_reasoning')).toBe('hard');
    expect(router.tierForTask('chat', { hard: true })).toBe('hard');
  });
});

describe('UsageService.enforceDailyAiQuota', () => {
  function makeService(usedToday: number) {
    const prisma = { usageEvent: { count: vi.fn().mockResolvedValue(usedToday) } };
    return new UsageService(prisma as never);
  }
  const entitlement = {
    tier: 'free' as const,
    status: 'active' as const,
    expiresAt: null,
    quotas: { dailyAiLimit: 20, monthlyAiLimit: null },
  };

  it('allows usage under the cap', async () => {
    await expect(makeService(5).enforceDailyAiQuota('u1', entitlement)).resolves.toBeUndefined();
  });

  it('throws 429 at the cap', async () => {
    await expect(makeService(20).enforceDailyAiQuota('u1', entitlement)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
