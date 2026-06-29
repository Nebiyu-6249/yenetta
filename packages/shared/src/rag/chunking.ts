/** Pure text chunking for the ingestion pipeline (browser-safe). */

export interface ChunkOptions {
  /** Target maximum characters per chunk. */
  maxChars?: number;
  /** Characters of overlap carried between consecutive chunks. */
  overlap?: number;
}

/**
 * Splits text into overlapping chunks, preferring sentence/paragraph
 * boundaries. Overlap preserves context across chunk edges for retrieval.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 800;
  const overlap = options.overlap ?? 100;
  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Split into sentence-ish units, then greedily pack into chunks.
  const units = clean.split(/(?<=[.!?。፡።])\s+|\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const unit of units) {
    const piece = unit.trim();
    if (!piece) continue;
    if (current.length + piece.length + 1 > maxChars && current) {
      chunks.push(current.trim());
      current = overlap > 0 ? current.slice(Math.max(0, current.length - overlap)) : '';
    }
    current += (current ? ' ' : '') + piece;
    // A single oversized unit gets hard-split.
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars - overlap);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
