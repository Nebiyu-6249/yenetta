import type { PrismaClient } from '@prisma/client';
import { toPgVector } from '@yenetta/shared';
import { type EmbedFn } from './classify';

export interface ReembedDeps {
  prisma: Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>;
  embed: EmbedFn;
  /** The active model; chunks embedded with any other model are re-embedded. */
  embeddingModel: string;
  batchSize?: number;
}

export interface ReembedResult {
  reembedded: number;
}

export interface ModelCount {
  embeddingModel: string;
  count: number;
}

/** How many chunks each embedding model produced (for drift warnings). */
export async function countChunksByModel(
  prisma: Pick<PrismaClient, '$queryRawUnsafe'>,
): Promise<ModelCount[]> {
  const rows = await prisma.$queryRawUnsafe<{ embeddingModel: string; count: number }[]>(
    `SELECT "embeddingModel", count(*)::int AS count FROM content_chunks GROUP BY "embeddingModel"`,
  );
  return rows.map((r) => ({ embeddingModel: r.embeddingModel, count: Number(r.count) }));
}

/**
 * Re-embeds every chunk whose vector came from a different model than the
 * active one (or has no vector), in batches, from the chunk's stored text.
 * Run after switching embedding provider/model so retrieval, which only
 * searches the active model's chunks, sees the whole corpus again.
 */
export async function reembedStaleChunks({
  prisma,
  embed,
  embeddingModel,
  batchSize = 64,
}: ReembedDeps): Promise<ReembedResult> {
  let reembedded = 0;
  for (;;) {
    const batch = await prisma.$queryRawUnsafe<{ id: string; text: string }[]>(
      `SELECT id, text FROM content_chunks
       WHERE "embeddingModel" <> $1 OR embedding IS NULL
       ORDER BY id
       LIMIT $2`,
      embeddingModel,
      batchSize,
    );
    if (batch.length === 0) return { reembedded };

    const vectors = await embed(batch.map((c) => c.text));
    if (vectors.length !== batch.length) {
      throw new Error(`Embedder returned ${vectors.length} vectors for ${batch.length} chunks`);
    }
    for (let i = 0; i < batch.length; i++) {
      await prisma.$executeRawUnsafe(
        `UPDATE content_chunks SET embedding = $1::vector, "embeddingModel" = $2 WHERE id = $3`,
        toPgVector(vectors[i]!),
        embeddingModel,
        batch[i]!.id,
      );
    }
    reembedded += batch.length;
  }
}
