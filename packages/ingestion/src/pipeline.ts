/**
 * Content ingestion pipeline stages (skeleton for M0).
 *
 * The real implementation lands in Milestone 2:
 *   OCR → clean → classify (subject/chapter/year via LLM) → chunk → embed → pgvector.
 * For now these are typed no-op stages so the worker boots and the shape is fixed.
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
