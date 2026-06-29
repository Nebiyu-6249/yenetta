import { describe, expect, it } from 'vitest';
import { brandHeader } from './brand';

describe('mobile brand header', () => {
  it('pulls the wordmark and primary color from shared tokens', () => {
    const header = brandHeader();
    expect(header.wordmark).toBe('Yenetta AI');
    expect(header.primary).toBe('#B08A45');
  });
});
