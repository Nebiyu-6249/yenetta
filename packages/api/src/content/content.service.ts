import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
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
import { validateUpload } from './upload-validation';

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
    // Reject bad/oversized/mismatched files at the boundary before storing.
    validateUpload(file);

    // Private uploads are scoped to their owner; public is shared curriculum.
    const visibility = overrides.visibility === 'private' ? 'private' : 'public';
    const ownerId = visibility === 'private' ? uploaderId : undefined;
    const scopedOverrides: IngestionOverrides = { ...overrides, visibility, ownerId };

    const doc = await this.prisma.contentDocument.create({
      data: {
        uploaderId,
        filename: file.filename,
        type: overrides.type ?? 'curriculum',
        visibility,
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
        overrides: scopedOverrides,
      });
    } else {
      try {
        await runIngestionPipeline(
          {
            prisma: this.prisma,
            embed: (texts) => this.llm.embed(texts).then((r) => r.embeddings),
          },
          { documentId: doc.id, file, overrides: scopedOverrides },
        );
      } catch {
        // Malformed/unreadable file (e.g. a corrupt PDF): fail safe with a 422,
        // not a 500. The document is left in `failed` status by the pipeline.
        throw new UnprocessableEntityException('Could not extract text from the uploaded document');
      }
    }

    return this.prisma.contentDocument.findUniqueOrThrow({ where: { id: doc.id } });
  }

  getStatus(id: string): Promise<ContentDocument | null> {
    return this.prisma.contentDocument.findUnique({ where: { id } });
  }

  list(): Promise<ContentDocument[]> {
    return this.prisma.contentDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** A user's own uploaded documents (private-notes view). */
  listForUploader(uploaderId: string): Promise<ContentDocument[]> {
    return this.prisma.contentDocument.findMany({
      where: { uploaderId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
