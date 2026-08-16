import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { chunkText, toPgVector } from '@yenetta/shared';
import { classifyDocument, type EmbedFn } from './classify';
import { extractText, type UploadedFile } from './extract';
import { cleanText } from './pipeline';

export interface IngestionDeps {
  prisma: PrismaClient;
  embed: EmbedFn;
}

export interface IngestionOverrides {
  subjectId?: string;
  chapterId?: string;
  year?: number;
  type?: 'curriculum' | 'exam_question';
  /** Upload isolation: owner + visibility stamped on every chunk. */
  ownerId?: string;
  visibility?: 'public' | 'private';
}

export interface IngestionInput {
  documentId: string;
  file: UploadedFile;
  overrides?: IngestionOverrides;
}

export interface IngestionResult {
  documentId: string;
  chunkCount: number;
  chapterId: string | null;
  subjectId: string | null;
}

/**
 * Runs the full pipeline for one document, advancing its status at each stage:
 * ocr -> cleaned -> classified -> embedded. Idempotent: re-ingesting a
 * document replaces its previous chunks.
 */
export async function runIngestionPipeline(
  { prisma, embed }: IngestionDeps,
  input: IngestionInput,
): Promise<IngestionResult> {
  const { documentId, file } = input;
  try {
    await prisma.contentDocument.update({ where: { id: documentId }, data: { status: 'ocr' } });
    const rawText = await extractText(file);

    await prisma.contentDocument.update({ where: { id: documentId }, data: { status: 'cleaned' } });
    const text = cleanText(rawText);
    if (!text) {
      throw new Error('No text could be extracted from the document');
    }

    const chapters = await prisma.chapter.findMany({
      select: { id: true, subjectId: true, grade: true, title: true, objectives: true },
    });
    const classification = await classifyDocument(text, chapters, embed, input.overrides ?? {});
    await prisma.contentDocument.update({
      where: { id: documentId },
      data: { status: 'classified' },
    });

    const chunks = chunkText(text, { maxChars: 800, overlap: 100 });
    const embeddings = await embed(chunks);
    const type = input.overrides?.type ?? 'curriculum';
    const ownerId = input.overrides?.ownerId ?? null;
    const visibility = input.overrides?.visibility ?? 'public';

    // Idempotent re-ingest: drop any prior chunks for this document.
    await prisma.contentChunk.deleteMany({ where: { sourceDocumentId: documentId } });

    for (let i = 0; i < chunks.length; i++) {
      // Raw SQL because Prisma cannot write the pgvector `embedding` column.
      await prisma.$executeRawUnsafe(
        `INSERT INTO content_chunks
           (id, text, embedding, "subjectId", "chapterId", grade, type, year, "sourceDocumentId", "ownerId", visibility, "createdAt")
         VALUES ($1, $2, $3::vector, $4, $5, $6, $7::"ContentType", $8, $9, $10, $11, now())`,
        randomUUID(),
        chunks[i],
        toPgVector(embeddings[i]!),
        classification.subjectId,
        classification.chapterId,
        classification.grade,
        type,
        classification.year,
        documentId,
        ownerId,
        visibility,
      );
    }

    await prisma.contentDocument.update({
      where: { id: documentId },
      data: { status: 'embedded' },
    });

    return {
      documentId,
      chunkCount: chunks.length,
      chapterId: classification.chapterId,
      subjectId: classification.subjectId,
    };
  } catch (err) {
    await prisma.contentDocument
      .update({ where: { id: documentId }, data: { status: 'failed' } })
      .catch(() => undefined);
    throw err;
  }
}
