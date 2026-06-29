import { gradeAnswers, type GradedResult, type SubmittedAnswer } from '@yenetta/shared';
import { makeOpId } from './remote';
import type { OfflineStore } from './store';
import type { CachedQuestion } from './types';

/** Past-paper practice graded entirely on-device; the attempt syncs later. */
export class OfflinePractice {
  constructor(private readonly store: OfflineStore) {}

  getQuestions(filter: { chapterId?: string; year?: number }): Promise<CachedQuestion[]> {
    return this.store.getQuestions(filter);
  }

  grade(questions: CachedQuestion[], answers: SubmittedAnswer[]): GradedResult {
    return gradeAnswers(
      questions.map((q) => ({ id: q.id, answer: q.answer, explanation: q.explanation })),
      answers,
    );
  }

  /** Grades locally and queues the attempt so server progress updates on sync. */
  async submit(
    questions: CachedQuestion[],
    answers: SubmittedAnswer[],
  ): Promise<{ graded: GradedResult; queued: boolean }> {
    const graded = this.grade(questions, answers);
    await this.store.enqueue({
      id: makeOpId(),
      type: 'practice_submit',
      payload: { answers },
      createdAt: Date.now(),
    });
    return { graded, queued: true };
  }
}
