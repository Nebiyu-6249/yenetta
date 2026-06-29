import { Inject, Injectable } from '@nestjs/common';
import type { Entitlement, FeatureQuotas, SubscriptionTier } from '@yenetta/shared';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface TierLimits {
  freeDailyAiLimit: number;
  premiumDailyAiLimit: number;
}

/**
 * Pure resolver: maps a tier to its quotas. Kept side-effect-free so it's
 * trivially unit-testable (BUILD_BRIEF §8 cost control).
 */
export function quotasForTier(tier: SubscriptionTier, limits: TierLimits): FeatureQuotas {
  if (tier === 'premium') {
    return { dailyAiLimit: limits.premiumDailyAiLimit, monthlyAiLimit: null };
  }
  return { dailyAiLimit: limits.freeDailyAiLimit, monthlyAiLimit: null };
}

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get limits(): TierLimits {
    return {
      freeDailyAiLimit: this.env.FREE_TIER_DAILY_AI_LIMIT,
      premiumDailyAiLimit: this.env.PREMIUM_TIER_DAILY_AI_LIMIT,
    };
  }

  /**
   * Resolves the active entitlement for a user. Defaults to the free tier when
   * there is no active subscription (M1 skeleton; payments wire it up in M6).
   */
  async resolve(userId: string): Promise<Entitlement> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { startedAt: 'desc' },
    });

    const tier: SubscriptionTier = subscription?.tier ?? 'free';
    return {
      tier,
      status: subscription?.status ?? 'active',
      expiresAt: subscription?.expiresAt?.toISOString() ?? null,
      quotas: quotasForTier(tier, this.limits),
    };
  }
}
