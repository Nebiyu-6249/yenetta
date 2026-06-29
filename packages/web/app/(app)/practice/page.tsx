'use client';

import { useEffect, useState } from 'react';
import {
  api,
  type ExamPaper,
  type GradedResult,
  type MockExam,
  type PracticeQuestion,
} from '../../../lib/api';
import { Button, Card, Spinner } from '../../../components/ui';
import { McqRunner } from '../../../components/mcq-runner';

type Tab = 'papers' | 'mocks';

export default function PracticePage() {
  const [tab, setTab] = useState<Tab>('papers');
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">Exam Practice</h1>
      <p className="mt-1 font-body text-sm text-muted">
        Practice past national exams or sit a timed mock.
      </p>
      <div className="mt-5 flex gap-1 border-b border-gold/10">
        {(['papers', 'mocks'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 font-body text-sm transition ${
              tab === t
                ? 'border-b-2 border-gold font-semibold text-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t === 'papers' ? 'Past papers' : 'Mock exams'}
          </button>
        ))}
      </div>
      <div className="mt-6">{tab === 'papers' ? <PastPapers /> : <MockExams />}</div>
    </div>
  );
}

function PastPapers() {
  const [papers, setPapers] = useState<ExamPaper[] | null>(null);
  const [active, setActive] = useState<ExamPaper | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);

  useEffect(() => {
    void api.papers().then(setPapers);
  }, []);

  const open = async (paper: ExamPaper) => {
    setActive(paper);
    setQuestions(null);
    setQuestions(await api.practice({ year: paper.year }));
  };

  if (active && questions) {
    return (
      <div>
        <button
          onClick={() => setActive(null)}
          className="mb-3 font-body text-sm text-gold hover:underline"
        >
          ← All papers
        </button>
        <h2 className="mb-4 font-heading text-lg font-semibold text-ink">
          {active.subject?.name} {active.year}
        </h2>
        <McqRunner
          questions={questions}
          onSubmit={(answers) => api.submitPractice(answers)}
          submitLabel="Submit practice"
        />
      </div>
    );
  }

  if (!papers) return <Spinner label="Loading papers…" />;
  if (papers.length === 0) return <Card>No past papers available yet.</Card>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {papers.map((p) => (
        <button
          key={p.id}
          onClick={() => void open(p)}
          className="rounded-xl border border-gold/15 bg-white p-4 text-left transition hover:border-gold"
        >
          <p className="font-heading text-sm font-semibold text-ink">
            {p.subject?.name ?? 'Exam'} · {p.year}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">Stream: {p.stream} · $0 to practice</p>
        </button>
      ))}
    </div>
  );
}

function MockExams() {
  const [mocks, setMocks] = useState<MockExam[] | null>(null);
  const [session, setSession] = useState<{
    attemptId: string;
    durationSeconds: number;
    questions: PracticeQuestion[];
  } | null>(null);

  useEffect(() => {
    void api.mocks().then(setMocks);
  }, []);

  if (session) {
    return (
      <div>
        <button
          onClick={() => setSession(null)}
          className="mb-3 font-body text-sm text-gold hover:underline"
        >
          ← All mocks
        </button>
        <TimedMock session={session} onExit={() => setSession(null)} />
      </div>
    );
  }

  if (!mocks) return <Spinner label="Loading mocks…" />;
  if (mocks.length === 0) return <Card>No mock exams available yet.</Card>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {mocks.map((m) => (
        <Card key={m.id}>
          <p className="font-heading text-sm font-semibold text-ink">{m.title}</p>
          <p className="mt-0.5 font-body text-xs text-muted">
            Timed · {Math.round(m.durationSeconds / 60)} minutes
          </p>
          <div className="mt-3">
            <Button onClick={() => void api.startMock(m.id).then(setSession)}>Start mock</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TimedMock({
  session,
  onExit,
}: {
  session: { attemptId: string; durationSeconds: number; questions: PracticeQuestion[] };
  onExit: () => void;
}) {
  const [remaining, setRemaining] = useState(session.durationSeconds);
  const [result, setResult] = useState<GradedResult | null>(null);

  useEffect(() => {
    if (result) return;
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, result]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div>
      {!result && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 font-body text-sm font-semibold text-bronze">
          ⏱ {mm}:{ss} remaining
        </div>
      )}
      <McqRunner
        questions={session.questions}
        submitLabel="Submit mock"
        onSubmit={async (answers) => {
          const elapsed = session.durationSeconds - remaining;
          const res = await api.submitMock(session.attemptId, answers, elapsed);
          setResult(res);
          return res;
        }}
      />
      {result && (
        <Button variant="secondary" className="mt-4" onClick={onExit}>
          Back to mocks
        </Button>
      )}
    </div>
  );
}
