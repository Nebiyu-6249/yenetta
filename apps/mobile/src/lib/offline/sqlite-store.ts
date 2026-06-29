import * as SQLite from 'expo-sqlite';
import type { OfflineStore } from './store';
import type {
  CachedChapter,
  CachedFlashcard,
  CachedQuestion,
  ChapterPack,
  SrCardRow,
  SyncOp,
} from './types';

interface ChapterRow {
  id: string;
  subjectId: string;
  title: string;
  summary: string;
  notes: string;
  updatedAt: number;
}
interface QuestionRow {
  id: string;
  chapterId: string | null;
  year: number | null;
  stem: string;
  options: string;
  answer: string;
  explanation: string | null;
}
interface QueueRow {
  id: string;
  type: SyncOp['type'];
  payload: string;
  createdAt: number;
}

/** On-device OfflineStore backed by expo-sqlite. */
export class SqliteOfflineStore implements OfflineStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private async database(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) this.db = await SQLite.openDatabaseAsync('yenetta.db');
    return this.db;
  }

  async init(): Promise<void> {
    const db = await this.database();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, subjectId TEXT, title TEXT, summary TEXT, notes TEXT, updatedAt INTEGER);
      CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, chapterId TEXT, front TEXT, back TEXT);
      CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, chapterId TEXT, year INTEGER, stem TEXT, options TEXT, answer TEXT, explanation TEXT);
      CREATE TABLE IF NOT EXISTS sr_cards (flashcardId TEXT PRIMARY KEY, chapterId TEXT, ease REAL, interval INTEGER, reps INTEGER, lapses INTEGER, dueAt INTEGER, lastReviewedAt INTEGER);
      CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, type TEXT, payload TEXT, createdAt INTEGER);
    `);
  }

  async saveChapterPack(pack: ChapterPack): Promise<void> {
    const db = await this.database();
    const { chapter, flashcards } = pack;
    await db.runAsync(
      'INSERT OR REPLACE INTO chapters (id, subjectId, title, summary, notes, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      chapter.id,
      chapter.subjectId,
      chapter.title,
      chapter.summary,
      JSON.stringify(chapter.notes),
      chapter.updatedAt,
    );
    await db.runAsync('DELETE FROM flashcards WHERE chapterId = ?', chapter.id);
    for (const f of flashcards) {
      await db.runAsync(
        'INSERT OR REPLACE INTO flashcards (id, chapterId, front, back) VALUES (?, ?, ?, ?)',
        f.id,
        f.chapterId,
        f.front,
        f.back,
      );
    }
  }

  async getChapter(chapterId: string): Promise<CachedChapter | null> {
    const db = await this.database();
    const row = await db.getFirstAsync<ChapterRow>(
      'SELECT * FROM chapters WHERE id = ?',
      chapterId,
    );
    return row ? this.toChapter(row) : null;
  }

  async listChapters(): Promise<CachedChapter[]> {
    const db = await this.database();
    const rows = await db.getAllAsync<ChapterRow>('SELECT * FROM chapters ORDER BY updatedAt DESC');
    return rows.map((r) => this.toChapter(r));
  }

  async getFlashcards(chapterId: string): Promise<CachedFlashcard[]> {
    const db = await this.database();
    return db.getAllAsync<CachedFlashcard>(
      'SELECT id, chapterId, front, back FROM flashcards WHERE chapterId = ?',
      chapterId,
    );
  }

  async saveQuestions(questions: CachedQuestion[]): Promise<void> {
    const db = await this.database();
    for (const q of questions) {
      await db.runAsync(
        'INSERT OR REPLACE INTO questions (id, chapterId, year, stem, options, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)',
        q.id,
        q.chapterId,
        q.year,
        q.stem,
        JSON.stringify(q.options),
        q.answer,
        q.explanation,
      );
    }
  }

  async getQuestions(filter: { chapterId?: string; year?: number }): Promise<CachedQuestion[]> {
    const db = await this.database();
    const where: string[] = [];
    const params: SQLite.SQLiteBindValue[] = [];
    if (filter.chapterId !== undefined) {
      where.push('chapterId = ?');
      params.push(filter.chapterId);
    }
    if (filter.year !== undefined) {
      where.push('year = ?');
      params.push(filter.year);
    }
    const sql = `SELECT * FROM questions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id`;
    const rows = await db.getAllAsync<QuestionRow>(sql, ...params);
    return rows.map((r) => ({
      id: r.id,
      chapterId: r.chapterId,
      year: r.year,
      stem: r.stem,
      options: JSON.parse(r.options) as string[],
      answer: r.answer,
      explanation: r.explanation,
    }));
  }

  async upsertSrCard(card: SrCardRow): Promise<void> {
    const db = await this.database();
    await db.runAsync(
      'INSERT OR REPLACE INTO sr_cards (flashcardId, chapterId, ease, interval, reps, lapses, dueAt, lastReviewedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      card.flashcardId,
      card.chapterId,
      card.ease,
      card.interval,
      card.reps,
      card.lapses,
      card.dueAt,
      card.lastReviewedAt,
    );
  }

  async getSrCard(flashcardId: string): Promise<SrCardRow | null> {
    const db = await this.database();
    return db.getFirstAsync<SrCardRow>('SELECT * FROM sr_cards WHERE flashcardId = ?', flashcardId);
  }

  async getDueSrCards(now: number): Promise<SrCardRow[]> {
    const db = await this.database();
    return db.getAllAsync<SrCardRow>(
      'SELECT * FROM sr_cards WHERE dueAt <= ? ORDER BY dueAt ASC',
      now,
    );
  }

  async enqueue(op: SyncOp): Promise<void> {
    const db = await this.database();
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_queue (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
      op.id,
      op.type,
      JSON.stringify(op.payload),
      op.createdAt,
    );
  }

  async listQueue(): Promise<SyncOp[]> {
    const db = await this.database();
    const rows = await db.getAllAsync<QueueRow>('SELECT * FROM sync_queue ORDER BY createdAt ASC');
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: JSON.parse(r.payload),
      createdAt: r.createdAt,
    }));
  }

  async removeFromQueue(id: string): Promise<void> {
    const db = await this.database();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
  }

  private toChapter(row: ChapterRow): CachedChapter {
    return {
      id: row.id,
      subjectId: row.subjectId,
      title: row.title,
      summary: row.summary,
      notes: JSON.parse(row.notes) as string[],
      updatedAt: row.updatedAt,
    };
  }
}
