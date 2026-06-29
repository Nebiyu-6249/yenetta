import { APP_TAGLINE, APP_WORDMARK, colors } from '@yenetta/shared';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-paper px-6 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-flame text-3xl shadow-lg"
        aria-hidden
      >
        🔥
      </div>

      <div className="space-y-3">
        <h1 className="font-heading text-5xl font-bold text-ink">{APP_WORDMARK}</h1>
        <p className="font-body text-lg text-muted">{APP_TAGLINE}</p>
      </div>

      <p className="max-w-md font-body text-sm text-muted">
        Milestone 0 — scaffold is live. The web app reads the shared brand theme (primary gold{' '}
        <code className="text-gold">{colors.gold}</code>).
      </p>

      <span className="rounded-full bg-cream px-4 py-1 font-body text-xs text-bronze">
        Web app · hello world
      </span>
    </main>
  );
}
