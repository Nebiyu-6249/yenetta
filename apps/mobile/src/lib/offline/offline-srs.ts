import { INITIAL_SR_STATE, nextDueDate, scheduleSm2 } from '@yenetta/shared';
import type { OfflineStore } from './store';
import type { CachedFlashcard, SrCardRow } from './types';

export interface DueReview {
  card: SrCardRow;
  flashcard: CachedFlashcard;
}

/** Spaced repetition that runs entirely on-device (works in airplane mode). */
export class OfflineSrs {
  constructor(private readonly store: OfflineStore) {}

  async listDue(now: number = Date.now()): Promise<DueReview[]> {
    const due = await this.store.getDueSrCards(now);
    const reviews: DueReview[] = [];
    for (const card of due) {
      const flashcards = await this.store.getFlashcards(card.chapterId);
      const flashcard = flashcards.find((f) => f.id === card.flashcardId);
      if (flashcard) reviews.push({ card, flashcard });
    }
    return reviews;
  }

  /** Applies an SM-2 review and reschedules the card locally. */
  async review(flashcardId: string, grade: number, now: number = Date.now()): Promise<SrCardRow> {
    const existing = await this.store.getSrCard(flashcardId);
    const state = existing
      ? {
          ease: existing.ease,
          interval: existing.interval,
          reps: existing.reps,
          lapses: existing.lapses,
        }
      : INITIAL_SR_STATE;
    const chapterId = existing?.chapterId ?? flashcardId.split('#')[0] ?? '';

    const next = scheduleSm2(state, grade);
    const updated: SrCardRow = {
      flashcardId,
      chapterId,
      ease: next.ease,
      interval: next.interval,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: nextDueDate(next.intervalDays, new Date(now)).getTime(),
      lastReviewedAt: now,
    };
    await this.store.upsertSrCard(updated);
    return updated;
  }
}
