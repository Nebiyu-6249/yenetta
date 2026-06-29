import type {
  CachedChapter,
  CachedFlashcard,
  CachedQuestion,
  ChapterPack,
  SrCardRow,
  SyncOp,
} from './types';

/**
 * Persistence boundary for offline data. Implemented by `SqliteOfflineStore`
 * (expo-sqlite, on-device) and `InMemoryOfflineStore` (tests). Keeping services
 * behind this interface lets the offline logic be unit-tested without a device.
 */
export interface OfflineStore {
  init(): Promise<void>;

  // Downloaded content
  saveChapterPack(pack: ChapterPack): Promise<void>;
  getChapter(chapterId: string): Promise<CachedChapter | null>;
  listChapters(): Promise<CachedChapter[]>;
  getFlashcards(chapterId: string): Promise<CachedFlashcard[]>;

  saveQuestions(questions: CachedQuestion[]): Promise<void>;
  getQuestions(filter: { chapterId?: string; year?: number }): Promise<CachedQuestion[]>;

  // Spaced repetition (local-only)
  upsertSrCard(card: SrCardRow): Promise<void>;
  getSrCard(flashcardId: string): Promise<SrCardRow | null>;
  getDueSrCards(now: number): Promise<SrCardRow[]>;

  // Sync queue
  enqueue(op: SyncOp): Promise<void>;
  listQueue(): Promise<SyncOp[]>;
  removeFromQueue(id: string): Promise<void>;
}
