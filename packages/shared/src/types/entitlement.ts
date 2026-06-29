import type { SubscriptionTier } from './domain';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

/** Per-feature usage caps resolved for a tier (BUILD_BRIEF §8). */
export interface FeatureQuotas {
  /** Max AI generations/conversations per day. */
  dailyAiLimit: number;
  /** Max per month (null = governed by daily cap / fair use). */
  monthlyAiLimit: number | null;
}

/** Server-resolved entitlement the client only reflects (BUILD_BRIEF §7). */
export interface Entitlement {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  /** ISO timestamp; null for the free tier (never expires). */
  expiresAt: string | null;
  quotas: FeatureQuotas;
}
