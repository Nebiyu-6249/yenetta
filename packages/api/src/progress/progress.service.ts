import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Mastery below this flags a chapter as a weak area (BUILD_BRIEF §M3). */
export const WEAK_AREA_THRESHOLD = 0.5;

export interface ProgressSummary {
  progress: { chapterId: string; mastery: number; lastStudied: Date | null }[];
  weakAreas: { chapterId: string; mastery: number }[];
}

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an activity result for a chapter as an exponential moving average
   * of mastery (0..1), so recent performance is weighted but history persists.
   */
  async recordResult(userId: string, chapterId: string, scoreFraction: number): Promise<void> {
    const score = Math.max(0, Math.min(1, scoreFraction));
    const existing = await this.prisma.userProgress.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
    });
    const mastery = existing ? existing.mastery * 0.6 + score * 0.4 : score;
    await this.prisma.userProgress.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: { userId, chapterId, mastery, lastStudied: new Date() },
      update: { mastery, lastStudied: new Date() },
    });
  }

  async getSummary(userId: string): Promise<ProgressSummary> {
    const rows = await this.prisma.userProgress.findMany({
      where: { userId },
      select: { chapterId: true, mastery: true, lastStudied: true },
      orderBy: { lastStudied: 'desc' },
    });
    return {
      progress: rows,
      weakAreas: rows
        .filter((r) => r.mastery < WEAK_AREA_THRESHOLD)
        .map((r) => ({ chapterId: r.chapterId, mastery: r.mastery })),
    };
  }
}
