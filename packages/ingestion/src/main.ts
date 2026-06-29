import { PrismaClient } from '@prisma/client';
import { Worker, type ConnectionOptions } from 'bullmq';
import { createEmbedder } from './embed';
import { INGESTION_QUEUE, type IngestionJobData } from './queue';
import { runIngestionPipeline } from './run-pipeline';

/** Parses a redis:// URL into BullMQ/ioredis connection options. */
function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Ingestion worker process (queue mode). Consumes content-ingestion jobs and
 * runs the OCR -> clean -> classify -> chunk -> embed -> pgvector pipeline.
 */
async function main(): Promise<void> {
  const connection = redisConnection();
  const prisma = new PrismaClient();
  const embed = createEmbedder({
    provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub',
    openaiApiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  });

  const worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE,
    async (job) => {
      const { documentId, file, overrides } = job.data;
      return runIngestionPipeline(
        { prisma, embed },
        {
          documentId,
          file: {
            filename: file.filename,
            mimetype: file.mimetype,
            buffer: Buffer.from(file.bufferBase64, 'base64'),
          },
          overrides,
        },
      );
    },
    { connection },
  );

  worker.on('completed', (job) => console.log(`[ingestion] job ${job.id} completed`));
  worker.on('failed', (job, err) =>
    console.error(`[ingestion] job ${job?.id} failed:`, err.message),
  );

  console.log(`[ingestion] worker ready on queue "${INGESTION_QUEUE}"`);
}

void main();
