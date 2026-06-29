import { describe, expect, it } from 'vitest';
import { buildStudySchedule } from './schedule';
import { levelForXp, updateStreak, xpForActivity } from '../gamification/stats';
import { t } from '../i18n/messages';

describe('buildStudySchedule', () => {
  const chapters = Array.from({ length: 5 }, (_, i) => ({ chapterId: `c${i}`, minutes: 30 }));
  const now = new Date('2026-01-01T00:00:00Z');

  it('packs chapters into days within the daily budget', () => {
    const items = buildStudySchedule(chapters, {
      examDate: new Date('2026-01-10T00:00:00Z'),
      dailyMinutes: 60,
      now,
    });
    expect(items).toHaveLength(5);
    // 60 min/day @ 30 min each → 2 chapters/day.
    expect(items[0]!.date).toBe('2026-01-01');
    expect(items[1]!.date).toBe('2026-01-01');
    expect(items[2]!.date).toBe('2026-01-02');
  });

  it('keeps the first (highest-priority) chapter on day one', () => {
    const items = buildStudySchedule(chapters, {
      examDate: new Date('2026-01-10T00:00:00Z'),
      dailyMinutes: 60,
      now,
    });
    expect(items[0]!.chapterId).toBe('c0');
  });
});

describe('gamification', () => {
  it('awards XP per activity and levels up with XP', () => {
    expect(xpForActivity('mock')).toBeGreaterThan(xpForActivity('chat'));
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(400)).toBe(3);
  });

  it('increments a streak on consecutive days and resets after a gap', () => {
    const d = (s: string) => new Date(`${s}T08:00:00Z`);
    expect(updateStreak(null, 0, d('2026-01-01')).streakDays).toBe(1);
    expect(updateStreak(d('2026-01-01'), 1, d('2026-01-02'))).toEqual({ streakDays: 2, isNewDay: true });
    expect(updateStreak(d('2026-01-01'), 3, d('2026-01-01')).isNewDay).toBe(false);
    expect(updateStreak(d('2026-01-01'), 5, d('2026-01-05')).streakDays).toBe(1);
  });
});

describe('i18n', () => {
  it('translates UI strings and falls back to English', () => {
    expect(t('en', 'navStudy')).toBe('Study');
    expect(t('am', 'navStudy')).toBe('ጥናት');
    expect(t('am', 'explainInAmharic')).toContain('አማርኛ');
  });
});
