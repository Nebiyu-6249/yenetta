import { Injectable, NotFoundException } from '@nestjs/common';
import type { Stream } from '@prisma/client';
import { gradeAnswers, type GradedResult, type SubmittedAnswer } from '../common/grading';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';

export interface PracticeFilter {
  subjectId?: string;
  chapterId?: string;
  year?: number;
  paperId?: string;
}

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  // ── Past-exam practice (pure DB, $0 AI) ─────────────────────────────────

  listPapers(filter: { subjectId?: string; year?: number; stream?: Stream }) {
    return this.prisma.examPaper.findMany({
      where: { subjectId: filter.subjectId, year: filter.year, stream: filter.stream },
      orderBy: [{ year: 'desc' }],
      include: { subject: { select: { name: true, grade: true } } },
    });
  }

  /**
   * Full practice questions INCLUDING answers + explanations, for caching on
   * the offline-first mobile app (BUILD_BRIEF §M5). Grading then happens locally
   * with the shared grader. (Question-bank IP: gate + watermark in production.)
   */
  downloadQuestions(filter: PracticeFilter) {
    return this.prisma.examQuestion.findMany({
      where: {
        paperId: filter.paperId,
        chapterId: filter.chapterId,
        subjectId: filter.subjectId,
        year: filter.year,
      },
      select: {
        id: true,
        stem: true,
        options: true,
        answer: true,
        explanation: true,
        year: true,
        chapterId: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  /** Practice questions WITHOUT answers — by paper, chapter, subject, or year. */
  practiceQuestions(filter: PracticeFilter) {
    return this.prisma.examQuestion.findMany({
      where: {
        paperId: filter.paperId,
        chapterId: filter.chapterId,
        subjectId: filter.subjectId,
        year: filter.year,
      },
      select: { id: true, stem: true, options: true, year: true, chapterId: true },
      orderBy: { id: 'asc' },
    });
  }

  /** Grades a practice submission and updates per-chapter mastery. */
  async submitPractice(userId: string, answers: SubmittedAnswer[]): Promise<GradedResult> {
    const questions = await this.prisma.examQuestion.findMany({
      where: { id: { in: answers.map((a) => a.questionId) } },
      select: { id: true, answer: true, explanation: true, chapterId: true },
    });
    const graded = gradeAnswers(questions, answers);
    await this.updateProgressByChapter(userId, questions, graded);
    return graded;
  }

  // ── Timed mock exams ────────────────────────────────────────────────────

  listMocks() {
    return this.prisma.mockExam.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Starts a timed attempt; returns the questions (no answers) + duration. */
  async startMock(userId: string, mockExamId: string) {
    const mock = await this.prisma.mockExam.findUnique({ where: { id: mockExamId } });
    if (!mock) {
      throw new NotFoundException('Mock exam not found');
    }
    const questions = await this.mockQuestions(mock.subjectId, mock.year);
    const attempt = await this.prisma.mockAttempt.create({
      data: { userId, mockExamId },
      select: { id: true },
    });
    return {
      attemptId: attempt.id,
      durationSeconds: mock.durationSeconds,
      questions: questions.map((q) => ({ id: q.id, stem: q.stem, options: q.options })),
    };
  }

  /** Grades a mock attempt, records its duration, and updates mastery. */
  async submitMock(
    userId: string,
    attemptId: string,
    answers: SubmittedAnswer[],
    durationSeconds: number,
  ): Promise<GradedResult> {
    const attempt = await this.prisma.mockAttempt.findFirst({
      where: { id: attemptId, userId },
      select: { id: true, mockExamId: true },
    });
    if (!attempt) {
      throw new NotFoundException('Mock attempt not found');
    }
    const questions = await this.prisma.examQuestion.findMany({
      where: { id: { in: answers.map((a) => a.questionId) } },
      select: { id: true, answer: true, explanation: true, chapterId: true },
    });
    const graded = gradeAnswers(questions, answers);

    await this.prisma.mockAttempt.update({
      where: { id: attemptId },
      data: {
        score: graded.scoreFraction,
        answers: answers as unknown as object[],
        durationSeconds,
        completedAt: new Date(),
      },
    });
    await this.updateProgressByChapter(userId, questions, graded);
    return graded;
  }

  private mockQuestions(subjectId: string | null, year: number | null) {
    return this.prisma.examQuestion.findMany({
      where: { subjectId: subjectId ?? undefined, year: year ?? undefined },
      select: { id: true, stem: true, options: true },
      orderBy: { id: 'asc' },
    });
  }

  /** Records mastery per chapter from a graded set of questions. */
  private async updateProgressByChapter(
    userId: string,
    questions: { id: string; chapterId: string | null }[],
    graded: GradedResult,
  ): Promise<void> {
    const correctById = new Map(graded.results.map((r) => [r.questionId, r.correct]));
    const byChapter = new Map<string, { correct: number; total: number }>();
    for (const q of questions) {
      if (!q.chapterId) continue;
      const bucket = byChapter.get(q.chapterId) ?? { correct: 0, total: 0 };
      bucket.total++;
      if (correctById.get(q.id)) bucket.correct++;
      byChapter.set(q.chapterId, bucket);
    }
    for (const [chapterId, { correct, total }] of byChapter) {
      await this.progress.recordResult(userId, chapterId, total > 0 ? correct / total : 0);
    }
  }
}
