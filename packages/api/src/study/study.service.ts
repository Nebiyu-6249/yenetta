import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildFlashcards,
  buildNotes,
  buildQuiz,
  buildSummary,
  type GeneratedFlashcard,
  type GeneratedQuizQuestion,
} from '@yenetta/shared';
import { UsageService } from '../cost/usage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { StatsService } from '../gamification/stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { gradeAnswers, type SubmittedAnswer } from '../common/grading';

export type StudyContentType = 'summary' | 'notes' | 'flashcards' | 'quiz' | 'study_guide';

export interface StudyResult {
  type: StudyContentType;
  content: unknown;
  cached: boolean;
}

const VERSION = 1;
const GENERATED_BY = 'generator';

@Injectable()
export class StudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageService,
    private readonly progress: ProgressService,
    private readonly stats: StatsService,
  ) {}

  /** Ensures the chapter quiz exists, then returns it WITHOUT the answers. */
  async getQuizForTaking(userId: string, chapterId: string) {
    await this.generate(userId, chapterId, 'quiz');
    const quiz = await this.prisma.quiz.findFirst({
      where: { chapterId, generatedBy: GENERATED_BY },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        questions: { select: { id: true, stem: true, options: true } },
      },
    });
    if (!quiz) {
      throw new NotFoundException('No quiz available for this chapter');
    }
    return quiz;
  }

  /** Grades a quiz attempt, persists it, and updates chapter mastery. */
  async submitQuiz(userId: string, quizId: string, answers: SubmittedAnswer[]) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        chapterId: true,
        questions: { select: { id: true, answer: true, explanation: true } },
      },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const graded = gradeAnswers(quiz.questions, answers);
    await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score: graded.scoreFraction,
        answers: answers as unknown as object[],
      },
    });
    if (quiz.chapterId) {
      await this.progress.recordResult(userId, quiz.chapterId, graded.scoreFraction);
    }
    void this.stats.award(userId, 'quiz');
    return graded;
  }

  /** Enforces quota, then returns cached or freshly generated study content. */
  async generate(userId: string, chapterId: string, type: StudyContentType): Promise<StudyResult> {
    const entitlement = await this.entitlements.resolve(userId);
    await this.usage.enforceDailyAiQuota(userId, entitlement);

    const result = await this.getOrGenerate(chapterId, type);
    await this.usage.log({
      userId,
      feature: 'ai_generation',
      model: result.cached ? 'cache' : 'generator',
    });
    return result;
  }

  private async getOrGenerate(chapterId: string, type: StudyContentType): Promise<StudyResult> {
    const cached = await this.prisma.generatedContent.findUnique({
      where: { chapterId_type_version: { chapterId, type, version: VERSION } },
    });
    if (cached) {
      return { type, content: cached.content, cached: true };
    }

    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    const chunks = await this.prisma.contentChunk.findMany({
      where: { chapterId, type: 'curriculum' },
      select: { text: true },
    });
    const text = chunks.map((c) => c.text).join('\n');

    const content = await this.build(chapter.id, chapter.subjectId, type, text);
    await this.prisma.generatedContent.create({
      data: { chapterId, type, version: VERSION, content: content as object },
    });
    return { type, content, cached: false };
  }

  private async build(
    chapterId: string,
    subjectId: string,
    type: StudyContentType,
    text: string,
  ): Promise<unknown> {
    switch (type) {
      case 'summary':
        return { summary: buildSummary(text) };
      case 'notes':
        return { notes: buildNotes(text) };
      case 'flashcards': {
        const cards = buildFlashcards(text);
        await this.persistFlashcards(chapterId, cards);
        return { flashcards: cards };
      }
      case 'quiz': {
        const pool = await this.distractorPool(chapterId);
        const questions = buildQuiz(text, pool);
        await this.persistQuiz(chapterId, subjectId, questions);
        return { questions };
      }
      case 'study_guide':
        return {
          guide: {
            overview: buildSummary(text, 4),
            keyPoints: buildNotes(text, 8),
            flashcards: buildFlashcards(text, 6),
          },
        };
    }
  }

  /** Key terms from other chapters, used as quiz distractors. */
  private async distractorPool(chapterId: string): Promise<string[]> {
    const others = await this.prisma.chapter.findMany({
      where: { id: { not: chapterId } },
      select: { title: true },
      take: 20,
    });
    return others.map((c) => c.title);
  }

  private async persistFlashcards(chapterId: string, cards: GeneratedFlashcard[]): Promise<void> {
    await this.prisma.flashcard.deleteMany({ where: { chapterId, generatedBy: GENERATED_BY } });
    if (cards.length > 0) {
      await this.prisma.flashcard.createMany({
        data: cards.map((c) => ({
          chapterId,
          front: c.front,
          back: c.back,
          generatedBy: GENERATED_BY,
        })),
      });
    }
  }

  private async persistQuiz(
    chapterId: string,
    subjectId: string,
    questions: GeneratedQuizQuestion[],
  ): Promise<void> {
    await this.prisma.quiz.deleteMany({ where: { chapterId, generatedBy: GENERATED_BY } });
    if (questions.length === 0) return;
    await this.prisma.quiz.create({
      data: {
        chapterId,
        subjectId,
        title: 'Practice quiz',
        generatedBy: GENERATED_BY,
        questions: {
          create: questions.map((q) => ({
            stem: q.stem,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
          })),
        },
      },
    });
  }
}
