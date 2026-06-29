import type { SubmittedAnswer } from '@yenetta/shared';
import type { CachedQuestion } from './types';

/** The subset of the API the offline services depend on (fakeable in tests). */
export interface RemoteApi {
  studyContent(
    chapterId: string,
    type: 'summary' | 'notes' | 'flashcards',
  ): Promise<{ content: Record<string, unknown> }>;
  downloadQuestions(filter: { year?: number; chapterId?: string }): Promise<CachedQuestion[]>;
  submitPractice(answers: SubmittedAnswer[]): Promise<unknown>;
  submitQuiz(quizId: string, answers: SubmittedAnswer[]): Promise<unknown>;
}

export function makeOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
