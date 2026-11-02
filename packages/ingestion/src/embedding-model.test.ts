import type { PrismaClient } from '@prisma/client';
import { deterministicEmbed, STUB_EMBEDDING_MODEL } from '@yenetta/shared';
import { describe, expect, it, vi } from 'vitest';
import { createEmbedder, embedConfigFromEnv } from './embed';
import { reembedStaleChunks } from './reembed';
import { runIngestionPipeline } from './run-pipeline';

describe('embedConfigFromEnv + createEmbedder', () => {
  it('uses the stub, and reports its model, when no key is set', async () => {
    const embedder = createEmbedder(embedConfigFromEnv({}));
    expect(embedder.model).toBe(STUB_EMBEDDING_MODEL);
    const [v] = await embedder.embed(['cell biology']);
    expect(v).toEqual(deterministicEmbed('cell biology'));
  });

  it('honors LLM_PROVIDER=stub even when an OpenAI key is present', () => {
    const config = embedConfigFromEnv({ LLM_PROVIDER: 'stub', OPENAI_API_KEY: 'sk-x' });
    expect(config.provider).toBe('stub');
    expect(createEmbedder(config).model).toBe(STUB_EMBEDDING_MODEL);
  });

  it('reports the configured OpenAI embedding model when a key is set', () => {
    const config = embedConfigFromEnv({
      OPENAI_API_KEY: 'sk-x',
      EMBEDDING_MODEL: 'text-embedding-3-small',
    });
    expect(config.provider).toBe('openai');
    expect(createEmbedder(config).model).toBe('text-embedding-3-small');
  });
});

describe('runIngestionPipeline', () => {
  it('stamps the embedding model on every chunk it writes', async () => {
    const executeRaw = vi.fn(async () => 1);
    const prisma = {
      contentDocument: { update: vi.fn(async () => ({})) },
      chapter: {
        findMany: vi.fn(async () => [
          { id: 'ch1', subjectId: 's1', grade: 9, title: 'Cell Biology', objectives: ['cells'] },
        ]),
      },
      contentChunk: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $executeRawUnsafe: executeRaw,
    } as unknown as PrismaClient;

    await runIngestionPipeline(
      {
        prisma,
        embed: async (texts) => texts.map((t) => deterministicEmbed(t)),
        embeddingModel: 'model-under-test',
      },
      {
        documentId: 'doc1',
        file: {
          filename: 'notes.md',
          mimetype: 'text/markdown',
          buffer: Buffer.from('The cell is the basic unit of life. Mitochondria release energy.'),
        },
      },
    );

    expect(executeRaw).toHaveBeenCalled();
    for (const call of executeRaw.mock.calls as unknown as unknown[][]) {
      expect(String(call[0])).toContain('"embeddingModel"');
      expect(call).toContain('model-under-test');
    }
  });
});

describe('reembedStaleChunks', () => {
  it('re-embeds only chunks from another model, in batches, until none remain', async () => {
    // Three stale chunks; each UPDATE moves one onto the active model.
    const chunks = [
      { id: 'a', text: 'alpha', model: 'stub-embedding' },
      { id: 'b', text: 'beta', model: 'stub-embedding' },
      { id: 'c', text: 'gamma', model: 'stub-embedding' },
      { id: 'd', text: 'delta', model: 'text-embedding-3-small' },
    ];
    const prisma = {
      $queryRawUnsafe: vi.fn(async (_sql: string, model: string, limit: number) =>
        chunks
          .filter((c) => c.model !== model)
          .slice(0, limit)
          .map(({ id, text }) => ({ id, text })),
      ),
      $executeRawUnsafe: vi.fn(async (_sql: string, _vector: string, model: string, id: string) => {
        chunks.find((c) => c.id === id)!.model = model;
        return 1;
      }),
    };
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2]));

    const result = await reembedStaleChunks({
      prisma,
      embed,
      embeddingModel: 'text-embedding-3-small',
      batchSize: 2,
    });

    expect(result).toEqual({ reembedded: 3 });
    expect(embed).toHaveBeenCalledTimes(2); // batches of 2 + 1
    expect(chunks.every((c) => c.model === 'text-embedding-3-small')).toBe(true);
  });

  it('fails loudly if the embedder returns the wrong number of vectors', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn(async () => [{ id: 'a', text: 'alpha' }]),
      $executeRawUnsafe: vi.fn(async () => 1),
    };
    await expect(
      reembedStaleChunks({ prisma, embed: async () => [], embeddingModel: 'm' }),
    ).rejects.toThrow(/vectors/);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
