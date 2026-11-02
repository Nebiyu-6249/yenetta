import { describe, expect, it, vi } from 'vitest';
import { type Env } from '../config/env';
import { RetrievalService } from './retrieval.service';

function makeService(
  embeddingModel: string,
  counts: { embeddingModel: string; count: number }[] = [],
) {
  const prisma = {
    // Retrieval query returns no rows; the drift check returns `counts`.
    $queryRawUnsafe: vi.fn(async (sql: string) => (sql.includes('GROUP BY') ? counts : [])),
  };
  const llm = {
    embeddingModel,
    embed: vi.fn(async () => ({ model: embeddingModel, embeddings: [[0.1, 0.2]], inputTokens: 1 })),
  };
  const env = { RETRIEVAL_TOP_K: 6 } as Env;
  const service = new RetrievalService(prisma as never, llm as never, env);
  return { service, prisma };
}

describe('RetrievalService', () => {
  it('only searches chunks embedded with the active embedding model', async () => {
    const { service, prisma } = makeService('text-embedding-3-small');
    await service.retrieve('What is a cell?', {}, 3, 'user1');

    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as unknown as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain('c."embeddingModel" = $2');
    expect(params[1]).toBe('text-embedding-3-small');
    // Isolation gate and limit still bind after the model parameter.
    expect(sql).toContain(`c."ownerId" = $3`);
    expect(params).toContain('user1');
    expect(params[params.length - 1]).toBe(3);
  });

  it('warns at boot when chunks from another model are excluded', async () => {
    const { service } = makeService('text-embedding-3-small', [
      { embeddingModel: 'stub-embedding', count: 10 },
      { embeddingModel: 'text-embedding-3-small', count: 4 },
    ]);
    const warn = vi
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn')
      .mockImplementation(() => undefined);

    await service.onApplicationBootstrap();

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('10 on stub-embedding');
    expect(warn.mock.calls[0]![0]).toContain('db:reembed');
  });

  it('stays quiet when every chunk matches the active model', async () => {
    const { service } = makeService('stub-embedding', [
      { embeddingModel: 'stub-embedding', count: 10 },
    ]);
    const warn = vi
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn')
      .mockImplementation(() => undefined);

    await service.onApplicationBootstrap();
    expect(warn).not.toHaveBeenCalled();
  });
});
