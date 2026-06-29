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
  });

  it('selects the mock SMS provider in dev', () => {
    expect(createSmsProvider(env({ SMS_PROVIDER: 'mock' })).name).toBe('mock');
  });
});
