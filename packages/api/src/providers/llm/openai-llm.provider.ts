import { Logger } from '@nestjs/common';
import {
  type LlmChatOptions,
  type LlmChatResult,
  type LlmEmbedResult,
  type LlmProvider,
} from './llm-provider.interface';

export interface OpenAiModelConfig {
  apiKey: string;
  cheap: string;
  standard: string;
  hard: string;
  embedding: string;
}

interface ChatCompletionResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface EmbeddingResponse {
  data: { embedding: number[] }[];
  usage?: { prompt_tokens: number };
}

/** OpenAI implementation of the LLM provider (BUILD_BRIEF §4.1). */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiLlmProvider.name);
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(private readonly config: OpenAiModelConfig) {}

  modelForTier(tier: LlmChatOptions['tier']): string {
    switch (tier) {
      case 'hard':
        return this.config.hard;
      case 'standard':
        return this.config.standard;
      default:
        return this.config.cheap;
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`OpenAI ${path} failed: ${res.status} ${text}`);
      throw new Error(`OpenAI ${path} failed with ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async chat(options: LlmChatOptions): Promise<LlmChatResult> {
    const model = this.modelForTier(options.tier);
    const json = await this.post<ChatCompletionResponse>('/chat/completions', {
      model,
      messages: options.messages,
      max_tokens: options.maxOutputTokens ?? 1200,
      temperature: options.temperature ?? 0.2,
    });
    return {
      content: json.choices[0]?.message.content ?? '',
      model,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }

  async embed(texts: string[]): Promise<LlmEmbedResult> {
    const json = await this.post<EmbeddingResponse>('/embeddings', {
      model: this.config.embedding,
      input: texts,
    });
    return {
      model: this.config.embedding,
      embeddings: json.data.map((d) => d.embedding),
      inputTokens: json.usage?.prompt_tokens ?? 0,
    };
  }
}
