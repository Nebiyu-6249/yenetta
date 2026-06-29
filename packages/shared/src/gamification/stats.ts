/** Pure gamification helpers: XP, levels, and streaks (BUILD_BRIEF §M7). */

export type XpActivity = 'chat' | 'quiz' | 'practice' | 'mock' | 'flashcards';

const XP_REWARDS: Record<XpActivity, number> = {
  chat: 2,
  flashcards: 5,
  quiz: 10,
  practice: 15,
  mock: 25,
};

export function xpForActivity(activity: XpActivity): number {
  return XP_REWARDS[activity];
}

/** Level grows with the square root of XP (100 XP = level 2, 400 = level 3…). */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

export function xpToNextLevel(xp: number): number {
  const next = levelForXp(xp) + 1;
  const needed = Math.pow(next - 1, 2) * 100;
  return Math.max(0, needed - xp);
}

function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / (24 * 3600 * 1000));
}

export interface StreakUpdate {
  streakDays: number;
  /** True when this is the first activity of a new day (award once/day). */
  isNewDay: boolean;
}

/**
 * Updates a daily streak. Same day → unchanged; consecutive day → +1; a gap
 * resets to 1.
 */
export function updateStreak(
  lastActive: Date | null,
  currentStreak: number,
  now: Date = new Date(),
): StreakUpdate {
  if (!lastActive) {
    return { streakDays: 1, isNewDay: true };
  }
  const diff = dayNumber(now) - dayNumber(lastActive);
  if (diff <= 0) return { streakDays: Math.max(1, currentStreak), isNewDay: false };
  if (diff === 1) return { streakDays: currentStreak + 1, isNewDay: true };
  return { streakDays: 1, isNewDay: true };
}
