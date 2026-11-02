import { deterministicEmbed, selectLlmBackend, STUB_EMBEDDING_MODEL } from '@yenetta/shared';
import { type EmbedFn } from './classify';

export interface EmbedConfig {
  provider: 'openai' | 'stub';
  openaiApiKey?: string;
  embeddingModel: string;
}

/** An embedding function plus the model id it produces vectors for. */
export interface Embedder {
  model: string;
  embed: EmbedFn;
}

/**
 * Embedding config from process env, using the same backend rule as the API's
 * LLM factory (`selectLlmBackend`) so worker/seed vectors match API queries.
 */
export function embedConfigFromEnv(env: Record<string, string | undefined>): EmbedConfig {
  return {
    provider: selectLlmBackend(env),
    openaiApiKey: env.OPENAI_API_KEY,
    embeddingModel: env.EMBEDDING_MODEL || 'text-embedding-3-small',
  };
}

/**
 * Builds the embedding function for the worker. Uses OpenAI when configured,
 * otherwise the shared deterministic embedder — which MUST match what the API
 * uses for queries so vectors are comparable. The returned `model` is stamped
 * on every chunk written with it.
 */
export function createEmbedder(config: EmbedConfig): Embedder {
  if (config.provider === 'openai' && config.openaiApiKey) {
    const apiKey = config.openaiApiKey;
    return {
      model: config.embeddingModel,
      embed: async (texts: string[]): Promise<number[][]> => {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model: config.embeddingModel, input: texts }),
        });
        if (!res.ok) {
          throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
        }
        const json = (await res.json()) as { data: { embedding: number[] }[] };
        return json.data.map((d) => d.embedding);
      },
    };
  }
  return {
    model: STUB_EMBEDDING_MODEL,
    embed: async (texts: string[]): Promise<number[][]> => texts.map((t) => deterministicEmbed(t)),
  };
}
