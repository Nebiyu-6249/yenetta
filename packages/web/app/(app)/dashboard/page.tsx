'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type ProgressSummary } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Card, Spinner } from '../../../components/ui';

export default function DashboardPage() {
  const { user, entitlement } = useAuth();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const [prog, subjects] = await Promise.all([api.progress(), api.subjects()]);
      const map: Record<string, string> = {};
      await Promise.all(
        subjects.map(async (s) => {
          for (const ch of await api.chapters(s.id)) map[ch.id] = ch.title;
        }),
      );
      setTitles(map);
      setProgress(prog);
    })();
  }, []);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">
        Welcome{user?.name ? `, ${user.name}` : ''} 👋
      </h1>
      <p className="mt-1 font-body text-sm text-muted">
        {entitlement?.tier === 'premium' ? 'Premium plan' : 'Free plan'} · Track your mastery here.
      </p>

      {!progress ? (
        <div className="mt-8">
          <Spinner label="Loading progress…" />
        </div>
      ) : progress.progress.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-body text-sm text-muted">
            No activity yet. Take a{' '}
            <Link href="/practice" className="text-gold underline">
              practice exam
            </Link>{' '}
            or a{' '}
            <Link href="/study" className="text-gold underline">
              chapter quiz
            </Link>{' '}
            to start tracking mastery.
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Chapter mastery</h2>
            <div className="space-y-3">
              {progress.progress.map((p) => (
                <Card key={p.chapterId}>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-sm font-medium text-ink">
                      {titles[p.chapterId] ?? 'Chapter'}
                    </span>
                    <span className="font-body text-xs text-muted">
                      {Math.round(p.mastery * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream">
                    <div
                      className="h-full rounded-full bg-flame"
                      style={{ width: `${Math.round(p.mastery * 100)}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Focus areas</h2>
            {progress.weakAreas.length === 0 ? (
              <Card>
                <p className="font-body text-sm text-muted">
                  No weak areas detected — keep it up! 🎉
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {progress.weakAreas.map((w) => (
                  <Link
                    key={w.chapterId}
                    href={`/study/${w.chapterId}?title=${encodeURIComponent(titles[w.chapterId] ?? '')}`}
                  >
                    <Card className="border-error/30 transition hover:border-error">
                      <p className="font-body text-sm font-medium text-ink">
                        {titles[w.chapterId] ?? 'Chapter'}
                      </p>
                      <p className="font-body text-xs text-error">
                        {Math.round(w.mastery * 100)}% — needs review
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
