import { describe, expect, it } from 'vitest';
import { buildFlashcards, buildNotes, buildQuiz, buildSummary } from './generators';

const CHAPTER =
  'The cell is the basic structural and functional unit of life. ' +
  'Mitochondria are organelles that release energy through respiration. ' +
  'Photosynthesis is the process that converts carbon dioxide and water into glucose using light energy. ' +
  'Plant cells have a rigid cell wall for support.';

describe('study generators', () => {
  it('summarizes to the first few sentences', () => {
    const summary = buildSummary(CHAPTER, 2);
    expect(summary).toContain('The cell is the basic');
    expect(summary.split('. ').length).toBeLessThanOrEqual(3);
  });

  it('builds bulleted notes', () => {
    const notes = buildNotes(CHAPTER);
    expect(notes.length).toBeGreaterThan(1);
  });

  it('extracts definitional flashcards', () => {
    const cards = buildFlashcards(CHAPTER);
    expect(cards.length).toBeGreaterThan(0);
    const cell = cards.find((c) => c.front.toLowerCase().includes('cell'));
    expect(cell?.front).toMatch(/^What is/);
    expect(cell?.back).toContain('basic structural');
  });

  it('builds fill-in-the-blank MCQs whose answer is among the options', () => {
    const quiz = buildQuiz(CHAPTER, ['gravity', 'inflation', 'democracy']);
    expect(quiz.length).toBeGreaterThan(0);
    for (const q of quiz) {
      expect(q.stem).toContain('_____');
      expect(q.options).toContain(q.answer);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });
});
