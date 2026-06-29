import { Logger, NotImplementedException } from '@nestjs/common';
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

/**
 * OpenAI implementation skeleton (BUILD_BRIEF §4.1). Model routing + real calls
 * (with usage logging and prompt caching) are implemented in M2; for now the
 * class is wired and selectable but methods are not yet live.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiLlmProvider.name);

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

  async chat(_options: LlmChatOptions): Promise<LlmChatResult> {
    this.logger.warn('OpenAI chat() not implemented until M2');
    throw new NotImplementedException('OpenAI provider chat() lands in M2');
  }

  async embed(_texts: string[]): Promise<LlmEmbedResult> {
    this.logger.warn('OpenAI embed() not implemented until M2');
    throw new NotImplementedException('OpenAI provider embed() lands in M2');
  }
}
