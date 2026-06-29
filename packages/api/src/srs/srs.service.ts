import { Injectable } from '@nestjs/common';
import { INITIAL_SR_STATE, nextDueDate, scheduleSm2 } from '@yenetta/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface DueCard {
  flashcardId: string;
  front: string;
  back: string;
  dueAt: Date;
  reps: number;
}

@Injectable()
export class SrsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates SR cards (due now) for any of a chapter's flashcards the user lacks. */
  async initChapter(userId: string, chapterId: string): Promise<number> {
    const flashcards = await this.prisma.flashcard.findMany({
      where: { chapterId },
      select: { id: true },
    });
    if (flashcards.length === 0) return 0;

    const existing = await this.prisma.srCard.findMany({
      where: { userId, flashcardId: { in: flashcards.map((f) => f.id) } },
      select: { flashcardId: true },
    });
    const have = new Set(existing.map((e) => e.flashcardId));
    const toCreate = flashcards.filter((f) => !have.has(f.id));
    if (toCreate.length > 0) {
      await this.prisma.srCard.createMany({
        data: toCreate.map((f) => ({
          userId,
          flashcardId: f.id,
          ease: INITIAL_SR_STATE.ease,
          interval: INITIAL_SR_STATE.interval,
          reps: INITIAL_SR_STATE.reps,
          lapses: INITIAL_SR_STATE.lapses,
          dueAt: new Date(),
        })),
      });
    }
    return toCreate.length;
  }

  /** Cards currently due for review (optionally seeding a chapter first). */
  async listDue(userId: string, chapterId?: string): Promise<DueCard[]> {
    if (chapterId) {
      await this.initChapter(userId, chapterId);
    }
    const due = await this.prisma.srCard.findMany({
      where: { userId, dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
      take: 50,
    });
    if (due.length === 0) return [];

    const cards = await this.prisma.flashcard.findMany({
      where: { id: { in: due.map((d) => d.flashcardId) } },
      select: { id: true, front: true, back: true },
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    return due
      .filter((d) => byId.has(d.flashcardId))
      .map((d) => ({
        flashcardId: d.flashcardId,
        front: byId.get(d.flashcardId)!.front,
        back: byId.get(d.flashcardId)!.back,
        dueAt: d.dueAt,
        reps: d.reps,
      }));
  }

  /** Applies an SM-2 review and reschedules the card. */
  async review(
    userId: string,
    flashcardId: string,
    grade: number,
  ): Promise<{ dueAt: Date; intervalDays: number }> {
    const card = await this.prisma.srCard.upsert({
      where: { userId_flashcardId: { userId, flashcardId } },
      create: {
        userId,
        flashcardId,
        ease: INITIAL_SR_STATE.ease,
        interval: INITIAL_SR_STATE.interval,
        reps: INITIAL_SR_STATE.reps,
        lapses: INITIAL_SR_STATE.lapses,
        dueAt: new Date(),
      },
      update: {},
    });

    const next = scheduleSm2(
      { ease: card.ease, interval: card.interval, reps: card.reps, lapses: card.lapses },
      grade,
    );
    const dueAt = nextDueDate(next.intervalDays);
    await this.prisma.srCard.update({
      where: { userId_flashcardId: { userId, flashcardId } },
      data: {
        ease: next.ease,
        interval: next.interval,
        reps: next.reps,
        lapses: next.lapses,
        dueAt,
        lastReviewedAt: new Date(),
      },
    });
    return { dueAt, intervalDays: next.intervalDays };
  }
}
