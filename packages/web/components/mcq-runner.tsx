'use client';

import { useState } from 'react';
import type { GradedResult, PracticeQuestion } from '../lib/api';
import { Button, Card } from './ui';

interface Props {
  questions: PracticeQuestion[];
  submitLabel: string;
  onSubmit: (answers: { questionId: string; answer: string }[]) => Promise<GradedResult>;
}

/** Shared MCQ answering + grading UI for quizzes, practice, and mock exams. */
export function McqRunner({ questions, submitLabel, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await onSubmit(
        questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
      );
      setResult(res);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {result && (
        <Card className="border-gold bg-cream/40">
          <p className="font-heading text-lg font-bold text-ink">
            Score: {result.correct}/{result.total} ({Math.round(result.scoreFraction * 100)}%)
          </p>
        </Card>
      )}

      {questions.map((q, i) => {
        const r = result?.results.find((x) => x.questionId === q.id);
        return (
          <Card key={q.id}>
            <p className="font-body text-sm font-medium text-ink">
              {i + 1}. {q.stem}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt;
                const correct = r && opt === r.correctAnswer;
                const wrong = r && selected && !r.correct;
                return (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-body text-sm ${
                      correct
                        ? 'border-success bg-success/10'
                        : wrong
                          ? 'border-error bg-error/10'
                          : selected
                            ? 'border-gold bg-gold/10'
                            : 'border-gold/15'
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      disabled={!!result}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
            {r?.explanation && <p className="mt-2 font-body text-xs text-muted">{r.explanation}</p>}
          </Card>
        );
      })}

      {!result && (
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? 'Submitting…' : submitLabel}
        </Button>
      )}
    </div>
  );
}
