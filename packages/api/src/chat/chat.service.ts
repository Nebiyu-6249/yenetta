import { Inject, Injectable } from '@nestjs/common';
import {
  buildGroundedPrompt,
  MAX_SUPPORTING_CHUNKS,
  MIN_SUPPORTING_SIMILARITY,
  NOT_IN_CURRICULUM_MESSAGE,
  SUPPORTING_RELATIVE_RATIO,
  type CitedSource,
} from '@yenetta/shared';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { ModelRouter } from '../cost/model-router';
import { UsageService } from '../cost/usage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { StatsService } from '../gamification/stats.service';
import { MemoryService } from '../memory/memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LlmProvider } from '../providers/llm/llm-provider.interface';
import {
  RetrievalService,
  type RetrievalScope,
  type RetrievedChunk,
} from '../retrieval/retrieval.service';
import { ResponseCacheService } from './response-cache.service';

export interface ChatResult {
  conversationId: string;
  answer: string;
  sources: CitedSource[];
  grounded: boolean;
  cached: boolean;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageService,
    private readonly router: ModelRouter,
    private readonly cache: ResponseCacheService,
    private readonly memory: MemoryService,
    private readonly stats: StatsService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async chat(
    userId: string,
    message: string,
    scope: RetrievalScope = {},
    conversationId?: string,
    language: 'en' | 'am' = 'en',
  ): Promise<ChatResult> {
    // 1. Server-side quota enforcement BEFORE any spend.
    const entitlement = await this.entitlements.resolve(userId);
    await this.usage.enforceDailyAiQuota(userId, entitlement);

    const convId = await this.ensureConversation(userId, conversationId, message);
    await this.persistMessage(convId, 'user', message, null);

    // 2. Cache: identical (scope + language + question) is answered once, reused.
    const cacheKey = this.cache.key({ ...scope, language }, message);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      await this.persistMessage(convId, 'assistant', cached.answer, cached.sources);
      await this.usage.log({ userId, feature: 'ai_chat', model: 'cache' });
      return {
        conversationId: convId,
        ...cached,
        grounded: cached.sources.length > 0,
        cached: true,
      };
    }

    // 3. Scoped retrieval (owner-isolated: public content + this user's own
    //    private uploads only), then keep the chunks that genuinely support the
    //    question: above an absolute floor AND close to the best match.
    const retrieved = await this.retrieval.retrieve(
      message,
      scope,
      this.env.RETRIEVAL_TOP_K,
      userId,
    );
    const topSimilarity = retrieved[0]?.similarity ?? 0;
    const threshold = Math.max(
      MIN_SUPPORTING_SIMILARITY,
      topSimilarity * SUPPORTING_RELATIVE_RATIO,
    );
    const supporting =
      topSimilarity < MIN_SUPPORTING_SIMILARITY
        ? []
        : retrieved.filter((c) => c.similarity >= threshold).slice(0, MAX_SUPPORTING_CHUNKS);

    // 4. No support -> honest fallback, NO LLM call (no hallucination).
    if (supporting.length === 0) {
      const answer = NOT_IN_CURRICULUM_MESSAGE;
      await this.persistMessage(convId, 'assistant', answer, []);
      await this.usage.log({ userId, feature: 'ai_chat', model: 'fallback' });
      return { conversationId: convId, answer, sources: [], grounded: false, cached: false };
    }

    // 5. Grounded generation with citations, personalized by long-term memory
    //    and answered in the requested language (Amharic when language='am').
    const studentContext = await this.memory.getContext(userId).catch(() => '');
    const prompt = buildGroundedPrompt(
      message,
      supporting.map((c) => ({
        text: c.text,
        chapterTitle: c.chapterTitle,
        type: c.type,
        year: c.year,
      })),
      { studentContext: studentContext || undefined, language },
    );
    const tier = this.router.tierForTask('chat');
    const result = await this.llm.chat({
      messages: prompt,
      tier,
      maxOutputTokens: this.env.MAX_OUTPUT_TOKENS,
    });

    const sources = this.toSources(supporting);
    await this.persistMessage(convId, 'assistant', result.content, sources);
    await this.usage.log({
      userId,
      feature: 'ai_chat',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    // Never write a private-content answer to the SHARED cache (it is not keyed
    // by user) - that would leak one student's upload into another's answer.
    const usedPrivate = supporting.some((c) => c.visibility === 'private');
    if (!usedPrivate) {
      this.cache.set(cacheKey, { answer: result.content, sources });
    }
    void this.stats.award(userId, 'chat');

    return {
      conversationId: convId,
      answer: result.content,
      sources,
      grounded: true,
      cached: false,
    };
  }

  listConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getMessages(userId: string, conversationId: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) return [];
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, citedSources: true, createdAt: true },
    });
  }

  private toSources(chunks: RetrievedChunk[]): CitedSource[] {
    const seen = new Set<string>();
    const sources: CitedSource[] = [];
    for (const c of chunks) {
      const key = `${c.chapterId}:${c.year}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({
        chapterId: c.chapterId,
        chapterTitle: c.chapterTitle,
        type: c.type,
        year: c.year,
      });
    }
    return sources;
  }

  private async ensureConversation(
    userId: string,
    conversationId: string | undefined,
    firstMessage: string,
  ): Promise<string> {
    if (conversationId) {
      const existing = await this.prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
      });
      if (existing) return existing.id;
    }
    const created = await this.prisma.chatConversation.create({
      data: { userId, title: firstMessage.slice(0, 60) },
      select: { id: true },
    });
    return created.id;
  }

  private async persistMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    citedSources: CitedSource[] | null,
  ): Promise<void> {
    await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
        // CitedSource[] -> Prisma Json input.
        citedSources: citedSources ? (citedSources as unknown as object[]) : undefined,
      },
    });
  }
}
