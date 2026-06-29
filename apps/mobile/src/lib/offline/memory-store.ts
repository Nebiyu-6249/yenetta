import type { OfflineStore } from './store';
import type {
  CachedChapter,
  CachedFlashcard,
  CachedQuestion,
  ChapterPack,
  SrCardRow,
  SyncOp,
} from './types';

/** In-memory OfflineStore for tests (and a dev fallback). */
export class InMemoryOfflineStore implements OfflineStore {
  private chapters = new Map<string, CachedChapter>();
  private flashcards = new Map<string, CachedFlashcard[]>();
  private questions: CachedQuestion[] = [];
  private srCards = new Map<string, SrCardRow>();
  private queue: SyncOp[] = [];

  async init(): Promise<void> {}

  async saveChapterPack(pack: ChapterPack): Promise<void> {
    this.chapters.set(pack.chapter.id, pack.chapter);
    this.flashcards.set(pack.chapter.id, pack.flashcards);
  }

  async getChapter(chapterId: string): Promise<CachedChapter | null> {
    return this.chapters.get(chapterId) ?? null;
  }

  async listChapters(): Promise<CachedChapter[]> {
    return [...this.chapters.values()];
  }

  async getFlashcards(chapterId: string): Promise<CachedFlashcard[]> {
    return this.flashcards.get(chapterId) ?? [];
  }

  async saveQuestions(questions: CachedQuestion[]): Promise<void> {
    const ids = new Set(questions.map((q) => q.id));
    this.questions = [...this.questions.filter((q) => !ids.has(q.id)), ...questions];
  }

  async getQuestions(filter: { chapterId?: string; year?: number }): Promise<CachedQuestion[]> {
    return this.questions.filter(
      (q) =>
        (filter.chapterId === undefined || q.chapterId === filter.chapterId) &&
        (filter.year === undefined || q.year === filter.year),
    );
  }

  async upsertSrCard(card: SrCardRow): Promise<void> {
    this.srCards.set(card.flashcardId, card);
  }

  async getSrCard(flashcardId: string): Promise<SrCardRow | null> {
    return this.srCards.get(flashcardId) ?? null;
  }

  async getDueSrCards(now: number): Promise<SrCardRow[]> {
    return [...this.srCards.values()]
      .filter((c) => c.dueAt <= now)
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  async enqueue(op: SyncOp): Promise<void> {
    this.queue.push(op);
  }

  async listQueue(): Promise<SyncOp[]> {
    return [...this.queue].sort((a, b) => a.createdAt - b.createdAt);
  }

  async removeFromQueue(id: string): Promise<void> {
    this.queue = this.queue.filter((op) => op.id !== id);
  }
}
