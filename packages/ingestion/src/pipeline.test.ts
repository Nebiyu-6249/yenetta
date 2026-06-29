import { describe, expect, it } from 'vitest';
import { nextStage, PIPELINE_STAGES } from './pipeline';

describe('ingestion pipeline stages', () => {
  it('advances through the documented order', () => {
    expect(PIPELINE_STAGES).toEqual(['uploaded', 'ocr', 'cleaned', 'classified', 'embedded']);
    expect(nextStage('uploaded')).toBe('ocr');
    expect(nextStage('classified')).toBe('embedded');
  });

  it('returns null at the terminal stage', () => {
    expect(nextStage('embedded')).toBeNull();
  });
});
