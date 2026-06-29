/**
 * Isomorphic, deterministic embedding used as the offline/dev/test fallback
 * (no network, no API key). It MUST be identical wherever it runs so that
 * chunks embedded by the ingestion worker are comparable to query embeddings
 * computed by the API. Pure JS (FNV-1a hashing vectorizer), browser-safe.
 *
 * Stopwords are dropped and adjacent bigrams added so that unrelated texts
 * score near-zero cosine while topically related texts score clearly higher —
 * which makes the grounded-vs-fallback decision reliable. When OpenAI is
 * configured, real embeddings replace this; the dimension stays 1536.
 */

export const EMBEDDING_DIM = 1536;

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'as',
  'by',
  'from',
  'into',
  'about',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
  'do',
  'does',
  'did',
  'has',
  'have',
  'had',
  'can',
  'could',
  'will',
  'would',
  'should',
  'may',
  'might',
  'i',
  'you',
  'he',
  'she',
  'they',
  'we',
  'my',
  'your',
  'their',
  'our',
  'so',
  'such',
  'than',
  'then',
  'there',
  'here',
  'not',
  'no',
  'if',
  'while',
  'each',
  'any',
  'all',
  'some',
  'more',
  'most',
]);

function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ሀ-፿\s]/g, ' ') // keep latin, digits, Ethiopic
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Unigrams + adjacent bigrams; bigrams sharpen topical separation. */
function features(text: string): string[] {
  const tokens = tokenize(text);
  const feats = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    feats.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return feats;
}

/** Deterministic 1536-dim unit vector from text (signed hashing trick). */
export function deterministicEmbed(text: string, dim: number = EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const feat of features(text)) {
    const h = fnv1a(feat);
    const idx = h % dim;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] = (vec[idx] ?? 0) + sign;
  }
  // L2-normalize so cosine similarity == dot product.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] = (vec[i] ?? 0) / norm;
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Formats a vector as a pgvector literal, e.g. "[0.1,0.2,...]". */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
