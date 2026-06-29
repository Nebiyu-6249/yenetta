import { type Env } from '../../config/env';
import { type LlmProvider } from './llm-provider.interface';
import { OpenAiLlmProvider } from './openai-llm.provider';
import { StubLlmProvider } from './stub-llm.provider';

/**
 * Selects the LLM provider from config. Falls back to the deterministic stub
 * when OpenAI is requested but no API key is present (keeps dev/tests working).
 */
export function createLlmProvider(env: Env): LlmProvider {
  if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAiLlmProvider({
      apiKey: env.OPENAI_API_KEY,
      cheap: env.LLM_MODEL_CHEAP,
      standard: env.LLM_MODEL_STANDARD,
      hard: env.LLM_MODEL_HARD,
      embedding: env.EMBEDDING_MODEL,
    });
  }
  return new StubLlmProvider();
}
