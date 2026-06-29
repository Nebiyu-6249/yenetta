import { INITIAL_SR_STATE } from '@yenetta/shared';
import type { RemoteApi } from './remote';
import type { OfflineStore } from './store';
import type { CachedFlashcard } from './types';

/** Downloads a chapter's study pack / a year's questions for offline use. */
export class DownloadService {
  constructor(
    private readonly api: RemoteApi,
    private readonly store: OfflineStore,
  ) {}

  async downloadChapter(chapterId: string, subjectId: string, title: string): Promise<void> {
    const [summary, notes, flashcards] = await Promise.all([
      this.api.studyContent(chapterId, 'summary'),
      this.api.studyContent(chapterId, 'notes'),
      this.api.studyContent(chapterId, 'flashcards'),
    ]);

    const rawCards = (flashcards.content.flashcards as { front: string; back: string }[]) ?? [];
    const cards: CachedFlashcard[] = rawCards.map((c, i) => ({
      id: `${chapterId}#${i}`,
      chapterId,
      front: c.front,
      back: c.back,
    }));

    await this.store.saveChapterPack({
      chapter: {
        id: chapterId,
        subjectId,
        title,
        summary: String(summary.content.summary ?? ''),
        notes: (notes.content.notes as string[]) ?? [],
        updatedAt: Date.now(),
      },
      flashcards: cards,
    });

    // Seed SR cards (due now) for any new flashcards.
    for (const card of cards) {
      if (!(await this.store.getSrCard(card.id))) {
        await this.store.upsertSrCard({
          flashcardId: card.id,
          chapterId,
          ease: INITIAL_SR_STATE.ease,
          interval: INITIAL_SR_STATE.interval,
          reps: INITIAL_SR_STATE.reps,
          lapses: INITIAL_SR_STATE.lapses,
          dueAt: Date.now(),
          lastReviewedAt: null,
        });
      }
    }
  }

  async downloadPractice(year: number): Promise<number> {
    const questions = await this.api.downloadQuestions({ year });
    await this.store.saveQuestions(questions);
    return questions.length;
  }
}
