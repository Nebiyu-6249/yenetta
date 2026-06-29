import type { SubmittedAnswer } from '@yenetta/shared';
import type { RemoteApi } from './remote';
import type { OfflineStore } from './store';

export interface SyncResult {
  synced: number;
  remaining: number;
}

/** Flushes queued offline mutations to the server when back online. */
export class SyncService {
  constructor(
    private readonly api: RemoteApi,
    private readonly store: OfflineStore,
  ) {}

  async flush(): Promise<SyncResult> {
    const ops = await this.store.listQueue();
    let synced = 0;

    for (const op of ops) {
      try {
        if (op.type === 'practice_submit') {
          const p = op.payload as { answers: SubmittedAnswer[] };
          await this.api.submitPractice(p.answers);
        } else if (op.type === 'quiz_submit') {
          const p = op.payload as { quizId: string; answers: SubmittedAnswer[] };
          await this.api.submitQuiz(p.quizId, p.answers);
        }
        await this.store.removeFromQueue(op.id);
        synced++;
      } catch {
        // Likely still offline / transient — stop and retry on the next sync.
        break;
      }
    }

    const remaining = (await this.store.listQueue()).length;
    return { synced, remaining };
  }
}
