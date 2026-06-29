/** Shared MCQ grading for quizzes, past-paper practice, and mock exams. */

export interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export interface GradableQuestion {
  id: string;
  answer: string;
  explanation?: string | null;
}

export interface GradedQuestion {
  questionId: string;
  correct: boolean;
  correctAnswer: string;
  explanation?: string | null;
}

export interface GradedResult {
  total: number;
  correct: number;
  scoreFraction: number;
  results: GradedQuestion[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function gradeAnswers(
  questions: GradableQuestion[],
  submitted: SubmittedAnswer[],
): GradedResult {
  const byId = new Map(submitted.map((s) => [s.questionId, s.answer]));
  let correct = 0;
  const results: GradedQuestion[] = questions.map((q) => {
    const given = byId.get(q.id);
    const isCorrect = given !== undefined && normalize(given) === normalize(q.answer);
    if (isCorrect) correct++;
    return {
      questionId: q.id,
      correct: isCorrect,
      correctAnswer: q.answer,
      explanation: q.explanation ?? null,
    };
  });
  const total = questions.length;
  return { total, correct, scoreFraction: total > 0 ? correct / total : 0, results };
}
