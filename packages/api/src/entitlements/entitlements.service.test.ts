import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { type Env } from '../config/env';
import { type PrismaService } from '../prisma/prisma.service';
import { EntitlementsService, quotasForTier } from './entitlements.service';

const limits = { freeDailyAiLimit: 20, premiumDailyAiLimit: 300 };

function makeEnv(): Env {
  return {
    FREE_TIER_DAILY_AI_LIMIT: 20,
    PREMIUM_TIER_DAILY_AI_LIMIT: 300,
    JWT_ACCESS_SECRET: 'test-secret',
  } as Env;
}

describe('quotasForTier', () => {
  it('caps the free tier and uncaps premium monthly usage', () => {
    expect(quotasForTier('free', limits)).toEqual({ dailyAiLimit: 20, monthlyAiLimit: null });
    expect(quotasForTier('premium', limits)).toEqual({ dailyAiLimit: 300, monthlyAiLimit: null });
  });
});

describe('EntitlementsService.resolve', () => {
  function makeService(subscription: unknown) {
    const prisma = {
      subscription: { findFirst: vi.fn().mockResolvedValue(subscription) },
    };
    return new EntitlementsService(prisma as unknown as PrismaService, new JwtService({}), makeEnv());
  }

  it('defaults to the free tier when there is no active subscription', async () => {
    const ent = await makeService(null).resolve('user-1');
    expect(ent.tier).toBe('free');
    expect(ent.status).toBe('active');
    expect(ent.expiresAt).toBeNull();
    expect(ent.quotas.dailyAiLimit).toBe(20);
  });

  it('grants premium quotas for an active premium subscription', async () => {
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    const ent = await makeService({ tier: 'premium', status: 'active', expiresAt }).resolve(
      'user-1',
    );
    expect(ent.tier).toBe('premium');
    expect(ent.quotas.dailyAiLimit).toBe(300);
    expect(ent.expiresAt).toBe(expiresAt.toISOString());
  });

  it('issues a signed entitlement token that encodes the tier and expiry', async () => {
    const service = makeService({
      tier: 'premium',
      status: 'active',
      expiresAt: new Date(Date.now() + 2 * 86_400_000),
    });
    const signed = await service.issueSignedToken('user-1');
    const payload = await new JwtService({}).verifyAsync<{ tier: string; sub: string }>(
      signed.token,
      { secret: 'test-secret' },
    );
    expect(payload.tier).toBe('premium');
    expect(payload.sub).toBe('user-1');
    expect(new Date(signed.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
