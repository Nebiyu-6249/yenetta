import { describe, expect, it } from 'vitest';
import { chunkText } from './chunking';
import {
  cosineSimilarity,
  deterministicEmbed,
  EMBEDDING_DIM,
  selectLlmBackend,
  STUB_EMBEDDING_MODEL,
  toPgVector,
} from './embedding';
import {
  buildGroundedPrompt,
  MIN_SUPPORTING_SIMILARITY,
  MIN_SUPPORTING_SIMILARITY_REAL,
  minSupportingSimilarity,
} from './prompt';

describe('deterministicEmbed', () => {
  it('produces a unit-length vector of the right dimension', () => {
    const v = deterministicEmbed('the cell is the basic unit of life');
    expect(v).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('is deterministic', () => {
    expect(deterministicEmbed('photosynthesis')).toEqual(deterministicEmbed('photosynthesis'));
  });

  it('ranks topically related text higher than unrelated text', () => {
    const query = deterministicEmbed('explain the parts and organelles of a plant cell');
    const related = deterministicEmbed(
      'A plant cell contains organelles such as the nucleus, chloroplast and cell wall.',
    );
    const unrelated = deterministicEmbed(
      'The French Revolution began in 1789 and reshaped European politics.',
    );
    const simRelated = cosineSimilarity(query, related);
    const simUnrelated = cosineSimilarity(query, unrelated);
    expect(simRelated).toBeGreaterThan(simUnrelated);
    expect(simRelated).toBeGreaterThan(MIN_SUPPORTING_SIMILARITY);
  });

  it('formats a pgvector literal', () => {
    expect(toPgVector([1, 2, 3])).toBe('[1,2,3]');
  });
});

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('Short text.')).toEqual(['Short text.']);
  });

  it('splits long text into multiple bounded chunks', () => {
    const sentence = 'This is a sentence about biology and cells. ';
    const chunks = chunkText(sentence.repeat(60), { maxChars: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
  });
});

describe('buildGroundedPrompt', () => {
  it('includes a grounding system message and the context', () => {
    const msgs = buildGroundedPrompt('What is a cell?', [
      {
        text: 'A cell is the basic unit of life.',
        chapterTitle: 'Cell Biology',
        type: 'curriculum',
        year: null,
      },
    ]);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[0]!.content.toLowerCase()).toContain('only');
    expect(msgs[1]!.content).toContain('Cell Biology');
    expect(msgs[1]!.content).toContain('What is a cell?');
  });

  it('adds an Amharic instruction and student context when requested', () => {
    const msgs = buildGroundedPrompt(
      'What is a cell?',
      [
        {
          text: 'A cell is the basic unit of life.',
          chapterTitle: 'Cell Biology',
          type: 'curriculum',
          year: null,
        },
      ],
      { language: 'am', studentContext: 'still working on Cell Biology' },
    );
    expect(msgs[0]!.content).toContain('አማርኛ');
    expect(msgs[0]!.content).toContain('STUDENT CONTEXT');
  });
});

describe('selectLlmBackend', () => {
  it('uses OpenAI only when selected and a key is present', () => {
    expect(selectLlmBackend({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x' })).toBe('openai');
    expect(selectLlmBackend({ OPENAI_API_KEY: 'sk-x' })).toBe('openai');
    expect(selectLlmBackend({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: '' })).toBe('stub');
    expect(selectLlmBackend({ LLM_PROVIDER: 'openai' })).toBe('stub');
  });

  it('honors an explicit stub provider even when a key is set', () => {
    expect(selectLlmBackend({ LLM_PROVIDER: 'stub', OPENAI_API_KEY: 'sk-x' })).toBe('stub');
  });
});

describe('minSupportingSimilarity', () => {
  it('keeps the stub-tuned floor for the stub and a higher floor for real models', () => {
    expect(minSupportingSimilarity(STUB_EMBEDDING_MODEL)).toBe(MIN_SUPPORTING_SIMILARITY);
    expect(minSupportingSimilarity('text-embedding-3-small')).toBe(MIN_SUPPORTING_SIMILARITY_REAL);
    expect(MIN_SUPPORTING_SIMILARITY_REAL).toBeGreaterThan(MIN_SUPPORTING_SIMILARITY);
  });
});
