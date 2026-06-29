import { Inject, Injectable } from '@nestjs/common';
import { toPgVector } from '@yenetta/shared';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LlmProvider } from '../providers/llm/llm-provider.interface';

export interface RetrievalScope {
  subjectId?: string;
  chapterId?: string;
  grade?: number;
  year?: number;
  type?: 'curriculum' | 'exam_question';
}

export interface RetrievedChunk {
  id: string;
  text: string;
  type: 'curriculum' | 'exam_question';
  year: number | null;
  chapterId: string | null;
  chapterTitle: string | null;
  similarity: number;
}

interface RetrievedRow extends Omit<RetrievedChunk, 'similarity'> {
  similarity: number | string;
}

/**
 * Scoped vector retrieval (BUILD_BRIEF §4.2): filter by scope FIRST
 * (subject/chapter/year/type), then top-k vector similarity within that scope.
 */
@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async retrieve(
    query: string,
    scope: RetrievalScope = {},
    topK?: number,
  ): Promise<RetrievedChunk[]> {
    const k = Math.max(1, topK ?? this.env.RETRIEVAL_TOP_K);
    const { embeddings } = await this.llm.embed([query]);
    const vector = toPgVector(embeddings[0] ?? []);

    const conditions: string[] = ['c.embedding IS NOT NULL'];
    const params: unknown[] = [vector];
    let p = 2;
    if (scope.subjectId) {
      conditions.push(`c."subjectId" = $${p++}`);
      params.push(scope.subjectId);
    }
    if (scope.chapterId) {
      conditions.push(`c."chapterId" = $${p++}`);
      params.push(scope.chapterId);
    }
    if (scope.grade) {
      conditions.push(`c.grade = $${p++}`);
      params.push(scope.grade);
    }
    if (scope.type) {
      conditions.push(`c.type = $${p++}::"ContentType"`);
      params.push(scope.type);
    }
    if (scope.year) {
      conditions.push(`c.year = $${p++}`);
      params.push(scope.year);
    }
    const limitPlaceholder = `$${p}`;
    params.push(k);

    const sql = `
      SELECT c.id, c.text, c.type, c.year, c."chapterId",
             ch.title AS "chapterTitle",
             1 - (c.embedding <=> $1::vector) AS similarity
      FROM content_chunks c
      LEFT JOIN chapters ch ON ch.id = c."chapterId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.embedding <=> $1::vector
      LIMIT ${limitPlaceholder}`;

    const rows = await this.prisma.$queryRawUnsafe<RetrievedRow[]>(sql, ...params);
    return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
  }
}
