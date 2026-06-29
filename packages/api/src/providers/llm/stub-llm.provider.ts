import { deterministicEmbed } from '@yenetta/shared';
import {
  type LlmChatOptions,
  type LlmChatResult,
  type LlmEmbedResult,
  type LlmProvider,
} from './llm-provider.interface';

/**
 * Deterministic, offline LLM used when no OpenAI key is configured (dev/tests).
 * Embeddings use the shared deterministic embedder so they match the ingestion
 * worker; chat produces a grounded answer derived from the provided CONTEXT so
 * the end-to-end RAG flow (and citations) works without a network call.
 */
export class StubLlmProvider implements LlmProvider {
  readonly name = 'stub';

  async chat(options: LlmChatOptions): Promise<LlmChatResult> {
    const userMsg = [...options.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const context = this.extractFirstContext(userMsg);
    const content = context
      ? `Based on the curriculum: ${context} (See the cited sources below.)`
      : "I don't have enough curriculum context to answer that.";
    return {
      content,
      model: `stub-${options.tier ?? 'cheap'}`,
      inputTokens: Math.ceil(userMsg.length / 4),
      outputTokens: Math.ceil(content.length / 4),
    };
  }

  async embed(texts: string[]): Promise<LlmEmbedResult> {
    return {
      model: 'stub-embedding',
      embeddings: texts.map((t) => deterministicEmbed(t)),
      inputTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
    };
  }

  /** Pulls the first context snippet out of the grounded prompt. */
  private extractFirstContext(userMsg: string): string | null {
    const match = userMsg.match(/CONTEXT:\n([\s\S]*?)\n\nSTUDENT QUESTION:/);
    if (!match) return null;
    const body = match[1]!.replace(/^\[\d+\][^\n]*\n/, '').trim();
    return body.slice(0, 240) || null;
  }
}
