import { deterministicEmbed } from '@yenetta/shared';
import { type EmbedFn } from './classify';

export interface EmbedConfig {
  provider: 'openai' | 'stub';
  openaiApiKey?: string;
  embeddingModel: string;
}

/**
 * Builds the embedding function for the worker. Uses OpenAI when configured,
 * otherwise the shared deterministic embedder — which MUST match what the API
 * uses for queries so vectors are comparable.
 */
export function createEmbedder(config: EmbedConfig): EmbedFn {
  if (config.provider === 'openai' && config.openaiApiKey) {
    return async (texts: string[]): Promise<number[][]> => {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({ model: config.embeddingModel, input: texts }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as { data: { embedding: number[] }[] };
      return json.data.map((d) => d.embedding);
    };
  }
  return async (texts: string[]): Promise<number[][]> => texts.map((t) => deterministicEmbed(t));
}
