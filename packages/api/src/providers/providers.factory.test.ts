import { describe, expect, it } from 'vitest';
import { type Env } from '../config/env';
import { createLlmProvider } from './llm/llm.factory';
import { createSmsProvider } from './sms/sms.factory';

function env(overrides: Partial<Env>): Env {
  return overrides as Env;
}

describe('provider factories', () => {
  it('uses OpenAI when configured with a key, else the stub', () => {
    expect(createLlmProvider(env({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x' })).name).toBe(
      'openai',
    );
    expect(createLlmProvider(env({ LLM_PROVIDER: 'openai' })).name).toBe('stub');
    expect(createLlmProvider(env({ LLM_PROVIDER: 'stub' })).name).toBe('stub');
    expect(createLlmProvider(env({ LLM_PROVIDER: 'stub', OPENAI_API_KEY: 'sk-x' })).name).toBe(
      'stub',
    );
  });

  it('exposes the embedding model each provider writes and queries with', () => {
    const openai = createLlmProvider(
      env({
        LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-x',
        EMBEDDING_MODEL: 'text-embedding-3-small',
      }),
    );
    expect(openai.embeddingModel).toBe('text-embedding-3-small');
    expect(createLlmProvider(env({ LLM_PROVIDER: 'openai' })).embeddingModel).toBe(
      'stub-embedding',
    );
  });

  it('selects the mock SMS provider in dev', () => {
    expect(createSmsProvider(env({ SMS_PROVIDER: 'mock' })).name).toBe('mock');
  });
});
