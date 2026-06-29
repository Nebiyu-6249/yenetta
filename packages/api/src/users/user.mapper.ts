import type { User } from '@prisma/client';
import type { Grade, Stream, SubscriptionTier, UserProfile } from '@yenetta/shared';

function toGrade(value: number | null): Grade | null {
  return value === 9 || value === 10 || value === 11 || value === 12 ? value : null;
}

/** Maps a Prisma User (+ resolved tier) to the shared UserProfile shape. */
export function toUserProfile(user: User, tier: SubscriptionTier): UserProfile {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    grade: toGrade(user.grade),
    stream: (user.stream as Stream | null) ?? null,
    locale: user.locale,
    tier,
  };
}
