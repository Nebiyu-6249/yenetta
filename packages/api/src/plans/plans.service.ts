import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { buildStudySchedule } from '@yenetta/shared';
import { PrismaService } from '../prisma/prisma.service';

const MINUTES_PER_CHAPTER = 30;
const UNSTUDIED_MASTERY = 0.5;

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Generates a plan from an exam date, weak areas first. Archives prior plans. */
  async generate(userId: string, examDate: Date, dailyMinutes: number) {
    const ordered = await this.chaptersByPriority(userId);
    const schedule = buildStudySchedule(
      ordered.map((c) => ({ chapterId: c.id, minutes: MINUTES_PER_CHAPTER })),
      { examDate, dailyMinutes },
    );

    await this.prisma.studyPlan.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'archived' },
    });

    return this.prisma.studyPlan.create({
      data: {
        userId,
        examDate,
        dailyMinutes,
        items: {
          create: schedule.map((item, idx) => ({
            chapterId: item.chapterId,
            scheduledFor: new Date(item.date),
            minutes: item.minutes,
            order: idx,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  }

  getCurrent(userId: string) {
    return this.prisma.studyPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  }

  /** Re-prioritizes the remaining items by current mastery (adapts to performance). */
  async adapt(userId: string, planId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
      include: { items: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const masteryById = await this.masteryMap(userId);
    const remaining = plan.items
      .filter((i) => !i.done)
      .sort(
        (a, b) =>
          (masteryById.get(a.chapterId) ?? UNSTUDIED_MASTERY) -
          (masteryById.get(b.chapterId) ?? UNSTUDIED_MASTERY),
      );

    const schedule = buildStudySchedule(
      remaining.map((i) => ({ chapterId: i.chapterId, minutes: i.minutes })),
      { examDate: plan.examDate, dailyMinutes: plan.dailyMinutes },
    );

    await this.prisma.$transaction(
      remaining.map((item, idx) =>
        this.prisma.studyPlanItem.update({
          where: { id: item.id },
          data: { scheduledFor: new Date(schedule[idx]!.date), order: idx },
        }),
      ),
    );
    return this.getCurrent(userId);
  }

  async completeItem(userId: string, itemId: string) {
    const item = await this.prisma.studyPlanItem.findUnique({
      where: { id: itemId },
      include: { plan: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundException('Plan item not found');
    if (item.plan.userId !== userId) throw new ForbiddenException();
    return this.prisma.studyPlanItem.update({ where: { id: itemId }, data: { done: true } });
  }

  private async masteryMap(userId: string): Promise<Map<string, number>> {
    const progress = await this.prisma.userProgress.findMany({ where: { userId } });
    return new Map(progress.map((p) => [p.chapterId, p.mastery]));
  }

  /** Chapters sorted weak-first (low mastery), then unstudied, then mastered. */
  private async chaptersByPriority(userId: string) {
    const [chapters, masteryById] = await Promise.all([
      this.prisma.chapter.findMany({ select: { id: true } }),
      this.masteryMap(userId),
    ]);
    return [...chapters].sort(
      (a, b) =>
        (masteryById.get(a.id) ?? UNSTUDIED_MASTERY) - (masteryById.get(b.id) ?? UNSTUDIED_MASTERY),
    );
  }
}
