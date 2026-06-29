import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { INGESTION_QUEUE, type IngestionJobData } from '@yenetta/ingestion';
import { Queue, type ConnectionOptions } from 'bullmq';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';

/**
 * Producer for the ingestion queue (queue mode). Lazily connects to Redis only
 * when actually used, so inline-mode dev never needs Redis running.
 */
@Injectable()
export class IngestionQueueService implements OnModuleDestroy {
  private queue: Queue<IngestionJobData> | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  private connection(): ConnectionOptions {
    const url = new URL(this.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
    };
  }

  private getQueue(): Queue<IngestionJobData> {
    if (!this.queue) {
      this.queue = new Queue<IngestionJobData>(INGESTION_QUEUE, { connection: this.connection() });
    }
    return this.queue;
  }

  async enqueue(data: IngestionJobData): Promise<void> {
    await this.getQueue().add('ingest', data, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
