import { Injectable, Logger } from '@nestjs/common';
import { levelForXp, updateStreak, xpForActivity, xpToNextLevel, type XpActivity } from '@yenetta/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface StatsView {
  xp: number;
  level: number;
  streakDays: number;
  xpToNextLevel: number;
  leaderboardOptIn: boolean;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Awards XP + updates the daily streak. Fire-and-forget from activities. */
  async award(userId: string, activity: XpActivity): Promise<void> {
    try {
      const now = new Date();
      const stats = await this.prisma.userStats.findUnique({ where: { userId } });
      const xp = (stats?.xp ?? 0) + xpForActivity(activity);
      const streak = updateStreak(stats?.lastActiveAt ?? null, stats?.streakDays ?? 0, now);
      const data = { xp, level: levelForXp(xp), streakDays: streak.streakDays, lastActiveAt: now };
      await this.prisma.userStats.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    } catch (err) {
      this.logger.warn(`Failed to award XP to ${userId}: ${(err as Error).message}`);
    }
  }

  async getStats(userId: string): Promise<StatsView> {
    const stats = await this.prisma.userStats.findUnique({ where: { userId } });
    const xp = stats?.xp ?? 0;
    return {
      xp,
      level: levelForXp(xp),
      streakDays: stats?.streakDays ?? 0,
      xpToNextLevel: xpToNextLevel(xp),
      leaderboardOptIn: stats?.leaderboardOptIn ?? false,
    };
  }

  async setLeaderboardOptIn(userId: string, optIn: boolean): Promise<void> {
    await this.prisma.userStats.upsert({
      where: { userId },
      create: { userId, leaderboardOptIn: optIn },
      update: { leaderboardOptIn: optIn },
    });
  }

  /** Opt-in leaderboard, top by XP. */
  async leaderboard(limit = 20) {
    const rows = await this.prisma.userStats.findMany({
      where: { leaderboardOptIn: true },
      orderBy: { xp: 'desc' },
      take: limit,
      include: { user: { select: { name: true } } },
    });
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.user.name ?? 'Anonymous',
      xp: r.xp,
      level: r.level,
      streakDays: r.streakDays,
    }));
  }
}
