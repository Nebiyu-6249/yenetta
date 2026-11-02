import { PrismaClient } from '@prisma/client';
import {
  countChunksByModel,
  createEmbedder,
  embedConfigFromEnv,
  reembedStaleChunks,
} from '@yenetta/ingestion';

/**
 * Re-embeds content chunks written with a different embedding model than the
 * active one (from .env). Run after adding/changing OPENAI_API_KEY or
 * EMBEDDING_MODEL: until then those chunks are excluded from retrieval.
 *   pnpm --filter @yenetta/api db:reembed
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { embed, model } = createEmbedder(embedConfigFromEnv(process.env));
  const before = await countChunksByModel(prisma);
  console.log(`Active embedding model: ${model}`);
  console.log(`Chunks by model before: ${JSON.stringify(before)}`);

  const { reembedded } = await reembedStaleChunks({ prisma, embed, embeddingModel: model });

  console.log(`Re-embedded ${reembedded} chunk(s).`);
  console.log(`Chunks by model after: ${JSON.stringify(await countChunksByModel(prisma))}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
