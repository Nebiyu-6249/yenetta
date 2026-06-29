import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Entitlement, FeatureQuotas, SubscriptionTier } from '@yenetta/shared';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface TierLimits {
  freeDailyAiLimit: number;
  premiumDailyAiLimit: number;
}

/** Max lifetime of a cached offline entitlement token (forces periodic refresh). */
export const OFFLINE_TOKEN_MAX_DAYS = 7;

export interface SignedEntitlement {
  token: string;
  entitlement: Entitlement;
  /** ISO timestamp when the offline token stops being valid. */
  tokenExpiresAt: string;
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
    private readonly jwt: JwtService,
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
   * there is no active subscription — so a lapsed/expired subscription is
   * auto-downgraded at read time (progress is never deleted).
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

  /**
   * Issues a signed entitlement token the mobile app caches for offline gating.
   * It expires at the subscription expiry, capped so a stale token can't grant
   * access forever — offline premium ends when the pass lapses (BUILD_BRIEF §7).
   */
  async issueSignedToken(userId: string): Promise<SignedEntitlement> {
    const entitlement = await this.resolve(userId);
    const capMs = Date.now() + OFFLINE_TOKEN_MAX_DAYS * 24 * 3600 * 1000;
    const subMs = entitlement.expiresAt ? new Date(entitlement.expiresAt).getTime() : capMs;
    const expMs = Math.min(subMs, capMs);
    const expiresIn = Math.max(60, Math.floor((expMs - Date.now()) / 1000));

    const token = await this.jwt.signAsync(
      { sub: userId, tier: entitlement.tier, status: entitlement.status, type: 'entitlement' },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn },
    );
    return { token, entitlement, tokenExpiresAt: new Date(expMs).toISOString() };
  }
}
