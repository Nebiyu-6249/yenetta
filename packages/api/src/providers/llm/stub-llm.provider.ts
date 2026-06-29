import {
  type LlmChatOptions,
  type LlmChatResult,
  type LlmEmbedResult,
  type LlmProvider,
} from './llm-provider.interface';

/**
 * Deterministic, offline LLM stub used when no real provider is configured
 * (e.g. dev without an API key, or tests). Real generation arrives in M2.
 */
export class StubLlmProvider implements LlmProvider {
  readonly name = 'stub';

  async chat(options: LlmChatOptions): Promise<LlmChatResult> {
    const last = options.messages.at(-1)?.content ?? '';
    return {
      content: `[stub:${options.tier ?? 'cheap'}] grounded answer for: ${last.slice(0, 80)}`,
      model: `stub-${options.tier ?? 'cheap'}`,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  async embed(texts: string[]): Promise<LlmEmbedResult> {
    // 1536-dim zero vectors keep the shape correct without network calls.
    return {
      model: 'stub-embedding',
      embeddings: texts.map(() => new Array<number>(1536).fill(0)),
      inputTokens: 0,
    };
  }
}
