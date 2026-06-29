import { Inject, Injectable } from '@nestjs/common';
import type { ContentDocument } from '@prisma/client';
import {
  runIngestionPipeline,
  type IngestionOverrides,
  type UploadedFile,
} from '@yenetta/ingestion';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LlmProvider } from '../providers/llm/llm-provider.interface';
import { IngestionQueueService } from './ingestion-queue.service';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: IngestionQueueService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Stores an uploaded document and runs it through the ingestion pipeline.
   * In `inline` mode the API processes it directly (awaits to `embedded`);
   * in `queue` mode it enqueues a job for the ingestion worker.
   */
  async upload(
    file: UploadedFile,
    uploaderId: string,
    overrides: IngestionOverrides = {},
  ): Promise<ContentDocument> {
    const doc = await this.prisma.contentDocument.create({
      data: {
        uploaderId,
        filename: file.filename,
        type: overrides.type ?? 'curriculum',
        status: 'uploaded',
      },
    });

    if (this.env.INGESTION_MODE === 'queue') {
      await this.queue.enqueue({
        documentId: doc.id,
        file: {
          filename: file.filename,
          mimetype: file.mimetype,
          bufferBase64: file.buffer.toString('base64'),
        },
        overrides,
      });
    } else {
      await runIngestionPipeline(
        { prisma: this.prisma, embed: (texts) => this.llm.embed(texts).then((r) => r.embeddings) },
        { documentId: doc.id, file, overrides },
      );
    }

    return this.prisma.contentDocument.findUniqueOrThrow({ where: { id: doc.id } });
  }

  getStatus(id: string): Promise<ContentDocument | null> {
    return this.prisma.contentDocument.findUnique({ where: { id } });
  }

  list(): Promise<ContentDocument[]> {
    return this.prisma.contentDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
