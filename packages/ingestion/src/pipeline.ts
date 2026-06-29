/**
 * Content ingestion pipeline stages (BUILD_BRIEF M2):
 *   uploaded -> ocr -> cleaned -> classified -> embedded
 * Each stage updates `content_documents.status` so the admin UI can track it.
 */

export type PipelineStage = 'uploaded' | 'ocr' | 'cleaned' | 'classified' | 'embedded';

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'uploaded',
  'ocr',
  'cleaned',
  'classified',
  'embedded',
] as const;

export function nextStage(stage: PipelineStage): PipelineStage | null {
  const idx = PIPELINE_STAGES.indexOf(stage);
  if (idx < 0 || idx === PIPELINE_STAGES.length - 1) {
    return null;
  }
  return PIPELINE_STAGES[idx + 1] ?? null;
}

const TAB = 9;
const LF = 10;
const CR = 13;
const SPACE = 32;

/** Normalizes OCR/extracted text: strip control chars, collapse whitespace. */
export function cleanText(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    // Keep tab, newline, carriage return, and anything printable; drop other controls.
    if (code === TAB || code === LF || code === CR || code >= SPACE) {
      out += ch;
    } else {
      out += ' ';
    }
  }
  return out
    .replace(/[^\S\n]+/g, ' ') // collapse runs of non-newline whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
