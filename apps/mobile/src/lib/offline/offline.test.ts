import { describe, expect, it, vi } from 'vitest';
import { DownloadService } from './download-service';
import { InMemoryOfflineStore } from './memory-store';
import { OfflinePractice } from './offline-practice';
import { OfflineSrs } from './offline-srs';
import { SyncService } from './sync-service';
import type { RemoteApi } from './remote';
import type { CachedQuestion } from './types';

const QUESTIONS: CachedQuestion[] = [
  {
    id: 'q1',
    chapterId: 'c1',
    year: 2015,
    stem: 'pH of neutral?',
    options: ['0', '7'],
    answer: '7',
    explanation: 'neutral',
  },
  {
    id: 'q2',
    chapterId: 'c1',
    year: 2015,
    stem: 'Acid+base?',
    options: ['Salt', 'Gas'],
    answer: 'Salt',
    explanation: 'neutralisation',
  },
];

function fakeApi(overrides: Partial<RemoteApi> = {}): RemoteApi {
  return {
    studyContent: vi.fn(async (_id, type) => {
      if (type === 'summary') return { content: { summary: 'A cell is the basic unit of life.' } };
      if (type === 'notes')
        return { content: { notes: ['Cells have a nucleus', 'Plants have walls'] } };
      return {
        content: { flashcards: [{ front: 'What is a cell?', back: 'Basic unit of life' }] },
      };
    }),
    downloadQuestions: vi.fn(async () => QUESTIONS),
    submitPractice: vi.fn(async () => ({})),
    submitQuiz: vi.fn(async () => ({})),
    ...overrides,
  };
}

describe('DownloadService', () => {
  it('caches a chapter pack and seeds due SR cards', async () => {
    const store = new InMemoryOfflineStore();
    await new DownloadService(fakeApi(), store).downloadChapter('c1', 's1', 'Cell Biology');

    const chapter = await store.getChapter('c1');
    expect(chapter?.summary).toContain('basic unit');
    expect(chapter?.notes).toHaveLength(2);
    const cards = await store.getFlashcards('c1');
    expect(cards).toEqual([
      { id: 'c1#0', chapterId: 'c1', front: 'What is a cell?', back: 'Basic unit of life' },
    ]);
    expect(await store.getDueSrCards(Date.now())).toHaveLength(1);
  });

  it('caches downloaded practice questions (with answers) for offline grading', async () => {
    const store = new InMemoryOfflineStore();
    const n = await new DownloadService(fakeApi(), store).downloadPractice(2015);
    expect(n).toBe(2);
    expect(await store.getQuestions({ year: 2015 })).toHaveLength(2);
  });
});

describe('offline study works with no network', () => {
  it('grades a cached past-paper practice locally and queues it for sync', async () => {
    const store = new InMemoryOfflineStore();
    await new DownloadService(fakeApi(), store).downloadPractice(2015);

    const practice = new OfflinePractice(store);
    const questions = await practice.getQuestions({ year: 2015 });
    const { graded, queued } = await practice.submit(questions, [
      { questionId: 'q1', answer: '7' },
      { questionId: 'q2', answer: 'Gas' },
    ]);

    expect(graded.correct).toBe(1);
    expect(graded.total).toBe(2);
    expect(queued).toBe(true);
    expect(await store.listQueue()).toHaveLength(1);
  });

  it('reviews flashcards offline and reschedules via SM-2', async () => {
    const store = new InMemoryOfflineStore();
    await new DownloadService(fakeApi(), store).downloadChapter('c1', 's1', 'Cell Biology');
    const srs = new OfflineSrs(store);

    const due = await srs.listDue();
    expect(due).toHaveLength(1);

    const updated = await srs.review('c1#0', 5);
    expect(updated.reps).toBe(1);
    // No longer due immediately after a successful review.
    expect(await srs.listDue()).toHaveLength(0);
  });
});

describe('SyncService (reconnect)', () => {
  it('flushes queued attempts to the server once back online', async () => {
    const store = new InMemoryOfflineStore();
    const api = fakeApi();
    await new DownloadService(api, store).downloadPractice(2015);
    const practice = new OfflinePractice(store);
    const questions = await practice.getQuestions({ year: 2015 });
    await practice.submit(questions, [{ questionId: 'q1', answer: '7' }]);

    const result = await new SyncService(api, store).flush();
    expect(result.synced).toBe(1);
    expect(result.remaining).toBe(0);
    expect(api.submitPractice).toHaveBeenCalledOnce();
  });

  it('keeps the queue intact if the server is unreachable', async () => {
    const store = new InMemoryOfflineStore();
    const failing = fakeApi({
      submitPractice: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    await new DownloadService(failing, store).downloadPractice(2015);
    const practice = new OfflinePractice(store);
    await practice.submit(await practice.getQuestions({ year: 2015 }), [
      { questionId: 'q1', answer: '7' },
    ]);

    const result = await new SyncService(failing, store).flush();
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
  });
});
