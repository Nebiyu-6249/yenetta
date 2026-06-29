/** Local-cache data shapes for offline-first study (BUILD_BRIEF §M5). */

export interface CachedChapter {
  id: string;
  subjectId: string;
  title: string;
  summary: string;
  notes: string[];
  updatedAt: number;
}

export interface CachedFlashcard {
  /** Local id (`${chapterId}#${index}`) — SR state is per-device. */
  id: string;
  chapterId: string;
  front: string;
  back: string;
}

export interface CachedQuestion {
  id: string;
  chapterId: string | null;
  year: number | null;
  stem: string;
  options: string[];
  answer: string;
  explanation: string | null;
}

export interface SrCardRow {
  flashcardId: string;
  chapterId: string;
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  dueAt: number;
  lastReviewedAt: number | null;
}

/** Mutations made offline that must reach the server when reconnected. */
export type SyncOpType = 'practice_submit' | 'quiz_submit';

export interface SyncOp {
  id: string;
  type: SyncOpType;
  payload: unknown;
  createdAt: number;
}

export interface ChapterPack {
  chapter: CachedChapter;
  flashcards: CachedFlashcard[];
}
