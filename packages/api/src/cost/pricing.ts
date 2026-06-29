/**
 * Approximate model pricing (USD per 1M tokens) for cost estimation on every
 * AI call (BUILD_BRIEF §8). Stub models are free. Values are placeholders and
 * can be tuned without code changes elsewhere.
 */
interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICES: Record<string, ModelPrice> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1': { inputPer1M: 2.0, outputPer1M: 8.0 },
  'text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0 },
};

function priceFor(model: string): ModelPrice {
  if (PRICES[model]) return PRICES[model];
  if (model.startsWith('stub')) return { inputPer1M: 0, outputPer1M: 0 };
  // Unknown model: estimate conservatively at the cheap tier.
  return PRICES['gpt-4o-mini']!;
}

/** Estimated USD cost for a single call. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model);
  const cost =
    (inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M;
  // Round to 6 dp (matches the Decimal(12,6) column).
  return Math.round(cost * 1e6) / 1e6;
}
