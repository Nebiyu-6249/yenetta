'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type GradedResult } from '../../../../lib/api';
import { Button, Card, Spinner } from '../../../../components/ui';

type Tab = 'summary' | 'notes' | 'flashcards' | 'quiz';
const TABS: Tab[] = ['summary', 'notes', 'flashcards', 'quiz'];

export default function ChapterPage() {
  const params = useParams<{ chapterId: string }>();
  const search = useSearchParams();
  const chapterId = params.chapterId;
  const title = search.get('title') ?? 'Chapter';
  const [tab, setTab] = useState<Tab>('summary');

  return (
    <div>
      <Link href="/study" className="font-body text-sm text-gold hover:underline">
        ← Study
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-bold text-ink">{title}</h1>

      <div className="mt-5 flex gap-1 border-b border-gold/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 font-body text-sm capitalize transition ${
              tab === t
                ? 'border-b-2 border-gold font-semibold text-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'summary' && <TextContent chapterId={chapterId} type="summary" field="summary" />}
        {tab === 'notes' && <NotesContent chapterId={chapterId} />}
        {tab === 'flashcards' && <FlashcardsContent chapterId={chapterId} />}
        {tab === 'quiz' && <QuizContent chapterId={chapterId} />}
      </div>
    </div>
  );
}

function TextContent({
  chapterId,
  type,
  field,
}: {
  chapterId: string;
  type: 'summary';
  field: string;
}) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    void api.studyContent(chapterId, type).then((r) => setText(String(r.content[field] ?? '')));
  }, [chapterId, type, field]);
  if (text === null) return <Spinner label="Generating…" />;
  return (
    <Card>
      <p className="font-body leading-relaxed text-ink">{text}</p>
    </Card>
  );
}

function NotesContent({ chapterId }: { chapterId: string }) {
  const [notes, setNotes] = useState<string[] | null>(null);
  useEffect(() => {
    void api
      .studyContent(chapterId, 'notes')
      .then((r) => setNotes((r.content.notes as string[]) ?? []));
  }, [chapterId]);
  if (notes === null) return <Spinner label="Generating…" />;
  return (
    <Card>
      <ul className="space-y-2">
        {notes.map((n, i) => (
          <li key={i} className="flex gap-2 font-body text-sm text-ink">
            <span className="text-gold">•</span>
            {n}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FlashcardsContent({ chapterId }: { chapterId: string }) {
  const [cards, setCards] = useState<{ front: string; back: string }[] | null>(null);
  useEffect(() => {
    void api
      .studyContent(chapterId, 'flashcards')
      .then((r) => setCards((r.content.flashcards as { front: string; back: string }[]) ?? []));
  }, [chapterId]);
  if (cards === null) return <Spinner label="Generating…" />;
  if (cards.length === 0) return <Card>No flashcards for this chapter yet.</Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => (
        <Flashcard key={i} front={c.front} back={c.back} />
      ))}
    </div>
  );
}

function Flashcard({ front, back }: { front: string; back: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      onClick={() => setRevealed((r) => !r)}
      className="min-h-[110px] rounded-xl border border-gold/15 bg-white p-4 text-left transition hover:border-gold"
    >
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {revealed ? 'Answer' : 'Question'}
      </p>
      <p className="mt-1 font-body text-sm text-ink">{revealed ? back : front}</p>
      <p className="mt-2 font-body text-xs text-gold">
        {revealed ? 'Tap to hide' : 'Tap to reveal'}
      </p>
    </button>
  );
}

function QuizContent({ chapterId }: { chapterId: string }) {
  const [quiz, setQuiz] = useState<{
    id: string;
    questions: { id: string; stem: string; options: string[] }[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.quiz(chapterId).then(setQuiz);
  }, [chapterId]);

  const submit = useCallback(async () => {
    if (!quiz) return;
    setBusy(true);
    try {
      const res = await api.submitQuiz(
        quiz.id,
        quiz.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
      );
      setResult(res);
    } finally {
      setBusy(false);
    }
  }, [quiz, answers]);

  if (!quiz) return <Spinner label="Generating quiz…" />;
  if (quiz.questions.length === 0) return <Card>No quiz available for this chapter yet.</Card>;

  return (
    <div className="space-y-4">
      {result && (
        <Card className="border-gold bg-cream/40">
          <p className="font-heading text-lg font-bold text-ink">
            You scored {result.correct}/{result.total}
          </p>
        </Card>
      )}
      {quiz.questions.map((q, i) => {
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
          {busy ? 'Submitting…' : 'Submit answers'}
        </Button>
      )}
    </div>
  );
}
