import { describe, expect, it } from 'vitest';
import { gradeAnswers } from './grading';

const questions = [
  { id: 'q1', answer: '7', explanation: 'neutral pH' },
  { id: 'q2', answer: 'Neutralisation', explanation: 'acid + base' },
];

describe('gradeAnswers', () => {
  it('scores correct answers case-insensitively', () => {
    const r = gradeAnswers(questions, [
      { questionId: 'q1', answer: '7' },
      { questionId: 'q2', answer: 'neutralisation' },
    ]);
    expect(r.correct).toBe(2);
    expect(r.total).toBe(2);
    expect(r.scoreFraction).toBe(1);
  });

  it('marks wrong and missing answers and returns the correct answer + explanation', () => {
    const r = gradeAnswers(questions, [{ questionId: 'q1', answer: '14' }]);
    expect(r.correct).toBe(0);
    expect(r.scoreFraction).toBe(0);
    const q1 = r.results.find((x) => x.questionId === 'q1')!;
    expect(q1.correct).toBe(false);
    expect(q1.correctAnswer).toBe('7');
    expect(q1.explanation).toBe('neutral pH');
  });
});
