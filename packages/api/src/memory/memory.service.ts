import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const WEAK_THRESHOLD = 0.6;

export interface WeakChapter {
  chapterId: string;
  title: string;
  mastery: number;
}

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rebuilds the learning profile from the user's progress (weak chapters). */
  async rebuild(userId: string): Promise<{ summary: string; weak: WeakChapter[] }> {
    const progress = await this.prisma.userProgress.findMany({
      where: { userId, mastery: { lt: WEAK_THRESHOLD } },
      orderBy: { mastery: 'asc' },
      take: 5,
    });
    const chapters = await this.prisma.chapter.findMany({
      where: { id: { in: progress.map((p) => p.chapterId) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(chapters.map((c) => [c.id, c.title]));
    const weak: WeakChapter[] = progress.map((p) => ({
      chapterId: p.chapterId,
      title: titleById.get(p.chapterId) ?? 'a chapter',
      mastery: p.mastery,
    }));

    const summary = weak.length
      ? `The student is still working on: ${weak.map((w) => w.title).join(', ')}.`
      : '';

    await this.prisma.learningProfile.upsert({
      where: { userId },
      create: { userId, summary, weakChapters: weak as unknown as object[] },
      update: { summary, weakChapters: weak as unknown as object[] },
    });
    return { summary, weak };
  }

  /** Short memory string injected into the tutor prompt (empty if none). */
  async getContext(userId: string): Promise<string> {
    const profile = await this.prisma.learningProfile.findUnique({ where: { userId } });
    if (profile) return profile.summary;
    const { summary } = await this.rebuild(userId);
    return summary;
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.learningProfile.findUnique({ where: { userId } });
    if (profile) return profile;
    await this.rebuild(userId);
    return this.prisma.learningProfile.findUnique({ where: { userId } });
  }
}
