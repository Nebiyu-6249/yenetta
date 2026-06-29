'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Chapter, type Subject } from '../../../lib/api';
import { Spinner } from '../../../components/ui';

interface SubjectWithChapters extends Subject {
  chapters: Chapter[];
}

export default function StudyPage() {
  const [data, setData] = useState<SubjectWithChapters[] | null>(null);

  useEffect(() => {
    void (async () => {
      const subjects = await api.subjects();
      const withChapters = await Promise.all(
        subjects.map(async (s) => ({ ...s, chapters: await api.chapters(s.id) })),
      );
      setData(withChapters);
    })();
  }, []);

  if (!data) return <Spinner label="Loading curriculum…" />;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">Study</h1>
      <p className="mt-1 font-body text-sm text-muted">
        Pick a chapter for summaries, notes, flashcards, and quizzes.
      </p>

      <div className="mt-6 space-y-6">
        {data.map((subject) => (
          <section key={subject.id}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-ink">{subject.name}</h2>
              <span className="rounded-full bg-cream px-2.5 py-0.5 font-body text-xs text-bronze">
                Grade {subject.grade} · {subject.stream}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {subject.chapters.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/study/${ch.id}?title=${encodeURIComponent(ch.title)}`}
                  className="rounded-xl border border-gold/15 bg-white p-4 transition hover:border-gold"
                >
                  <p className="font-body text-xs text-muted">Unit {ch.unitNo}</p>
                  <p className="mt-0.5 font-heading text-sm font-semibold text-ink">{ch.title}</p>
                  {ch.objectives.length > 0 && (
                    <p className="mt-1 line-clamp-1 font-body text-xs text-muted">
                      {ch.objectives.join(' · ')}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
