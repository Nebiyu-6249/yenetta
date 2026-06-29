/** Provider-agnostic LLM contract (BUILD_BRIEF §4.1). Swappable via env. */

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export type LlmTier = 'cheap' | 'standard' | 'hard';

export interface LlmChatOptions {
  messages: LlmMessage[];
  tier?: LlmTier;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmChatResult extends LlmUsage {
  content: string;
}

export interface LlmEmbedResult {
  model: string;
  embeddings: number[][];
  inputTokens: number;
}

export interface LlmProvider {
  readonly name: string;
  chat(options: LlmChatOptions): Promise<LlmChatResult>;
  embed(texts: string[]): Promise<LlmEmbedResult>;
}
