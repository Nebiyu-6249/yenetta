import { HttpException } from '@nestjs/common';
import { NOT_IN_CURRICULUM_MESSAGE } from '@yenetta/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Env } from '../config/env';
import { ChatService } from './chat.service';

function makeMocks() {
  const prisma = {
    chatConversation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'conv1' }),
    },
    chatMessage: { create: vi.fn().mockResolvedValue({}) },
  };
  const retrieval = { retrieve: vi.fn() };
  const entitlements = {
    resolve: vi.fn().mockResolvedValue({ tier: 'free', quotas: { dailyAiLimit: 20 } }),
  };
  const usage = { enforceDailyAiQuota: vi.fn().mockResolvedValue(undefined), log: vi.fn() };
  const router = { tierForTask: vi.fn().mockReturnValue('cheap') };
  const cache = {
    key: vi.fn().mockReturnValue('k'),
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  };
  const memory = { getContext: vi.fn().mockResolvedValue('') };
  const stats = { award: vi.fn().mockResolvedValue(undefined) };
  const llm = {
    chat: vi.fn().mockResolvedValue({
      content: 'A cell is the basic unit of life.',
      model: 'stub-cheap',
      inputTokens: 10,
      outputTokens: 8,
    }),
  };
  const env = { RETRIEVAL_TOP_K: 6, MAX_OUTPUT_TOKENS: 1200 } as Env;

  const service = new ChatService(
    prisma as never,
    retrieval as never,
    entitlements as never,
    usage as never,
    router as never,
    cache as never,
    memory as never,
    stats as never,
    llm as never,
    env,
  );
  return { service, prisma, retrieval, entitlements, usage, router, cache, llm, memory, stats };
}

const supportingChunk = {
  id: 'chunk1',
  text: 'A cell is the basic unit of life.',
  type: 'curriculum' as const,
  year: null,
  chapterId: 'chap1',
  chapterTitle: 'Cell Biology',
  similarity: 0.9,
};

describe('ChatService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a grounded answer with sources when supporting context is found', async () => {
    const { service, retrieval, llm, usage, cache } = makeMocks();
    retrieval.retrieve.mockResolvedValue([supportingChunk]);

    const result = await service.chat('user1', 'What is a cell?', { chapterId: 'chap1' });

    expect(result.grounded).toBe(true);
    expect(result.answer).toContain('cell');
    expect(result.sources).toEqual([
      { chapterId: 'chap1', chapterTitle: 'Cell Biology', type: 'curriculum', year: null },
    ]);
    expect(llm.chat).toHaveBeenCalledOnce();
    expect(usage.log).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'ai_chat', model: 'stub-cheap' }),
    );
    expect(cache.set).toHaveBeenCalled();
  });

  it('falls back honestly (no LLM call) when nothing supports the question', async () => {
    const { service, retrieval, llm, usage } = makeMocks();
    retrieval.retrieve.mockResolvedValue([{ ...supportingChunk, similarity: 0.01 }]);

    const result = await service.chat('user1', 'Who won the 1998 World Cup?');

    expect(result.grounded).toBe(false);
    expect(result.answer).toBe(NOT_IN_CURRICULUM_MESSAGE);
    expect(result.sources).toEqual([]);
    expect(llm.chat).not.toHaveBeenCalled();
    expect(usage.log).toHaveBeenCalledWith(expect.objectContaining({ model: 'fallback' }));
  });

  it('serves identical questions from cache without calling the LLM', async () => {
    const { service, retrieval, llm, cache } = makeMocks();
    cache.get.mockReturnValue({ answer: 'cached answer', sources: [] });

    const result = await service.chat('user1', 'What is a cell?');

    expect(result.cached).toBe(true);
    expect(result.answer).toBe('cached answer');
    expect(retrieval.retrieve).not.toHaveBeenCalled();
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('enforces the daily quota before spending', async () => {
    const { service, usage, llm } = makeMocks();
    usage.enforceDailyAiQuota.mockRejectedValue(new HttpException('limit', 429));

    await expect(service.chat('user1', 'hi')).rejects.toBeInstanceOf(HttpException);
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('redacts PII from the message before it reaches the LLM', async () => {
    const { service, retrieval, llm, prisma } = makeMocks();
    retrieval.retrieve.mockResolvedValue([supportingChunk]);

    await service.chat('user1', 'What is a cell? Email me at kid@school.et or +251912345678');

    const sent = JSON.stringify(llm.chat.mock.calls[0][0].messages);
    expect(sent).not.toContain('kid@school.et');
    expect(sent).not.toContain('251912345678');
    expect(sent).toContain('[redacted-email]');
    expect(sent).toContain('[redacted-phone]');
    // The student's own message is still persisted verbatim (their data).
    const persistedUser = prisma.chatMessage.create.mock.calls.find(
      (c: [{ data: { role: string; content: string } }]) => c[0].data.role === 'user',
    );
    expect(persistedUser[0].data.content).toContain('kid@school.et');
  });
});
