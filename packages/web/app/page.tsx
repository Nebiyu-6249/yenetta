import Link from 'next/link';
import { ButtonLink } from '../components/ui';
import { Footer, MarketingNav } from '../components/marketing-nav';

const FEATURES = [
  {
    title: 'Chat-first tutor',
    body: 'Ask anything in plain language. Every answer is grounded in your textbooks and past papers — with sources, never guesswork.',
    icon: '',
  },
  {
    title: 'Study tools',
    body: 'Chapter summaries, study notes, flashcards with spaced repetition, and AI quizzes — built from the real curriculum.',
    icon: '',
  },
  {
    title: 'Exam practice',
    body: 'Practice past national exams by year and by chapter, with explanations, plus timed mock exams that feel like the real thing.',
    icon: '',
  },
  {
    title: 'Entrance-exam coach',
    body: 'Grade 12 ESSLCE/EUEE prep where every past question is linked to the chapter that teaches it.',
    icon: '',
  },
];

export default function Landing() {
  return (
    <>
      <MarketingNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
            <span className="mb-5 inline-block rounded-full bg-cream px-4 py-1 font-body text-xs font-medium text-bronze">
              For Ethiopian students · Grades 9–12
            </span>
            <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold leading-tight text-ink sm:text-6xl">
              Your AI study companion, grounded in the{' '}
              <span className="bg-flame bg-clip-text text-transparent">Ethiopian curriculum</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-body text-lg text-muted">
              Yenetta (የነታ) teaches from your actual textbooks and past national exams — so answers
              come with sources, and it says &ldquo;I don&rsquo;t know&rdquo; instead of guessing.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/login" variant="primary">
                Start studying free
              </ButtonLink>
              <ButtonLink href="/pricing" variant="secondary">
                See plans
              </ButtonLink>
            </div>
            <p className="mt-4 font-body text-xs text-muted">
              Works offline on Android · No credit card to start
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gold/15 bg-white p-7 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cream text-xl">
                  {f.icon}
                </div>
                <h3 className="font-heading text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Principles strip */}
        <section className="bg-cream/50">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 text-center sm:grid-cols-3">
            {[
              [
                'Grounded, not guessed',
                'Retrieval-based answers with citations from the curriculum.',
              ],
              [
                'Built for low data',
                'Offline-first Android: study and practice without a connection.',
              ],
              ['Affordable', 'Free tier to learn; premium for full entrance-exam prep.'],
            ].map(([title, body]) => (
              <div key={title}>
                <h4 className="font-heading text-base font-semibold text-ink">{title}</h4>
                <p className="mt-2 font-body text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-heading text-3xl font-bold text-ink">Ready for your next exam?</h2>
          <p className="mt-3 font-body text-muted">
            Join Yenetta and study smarter with a tutor that knows your curriculum.
          </p>
          <div className="mt-7">
            <ButtonLink href="/login" variant="primary">
              Create your free account
            </ButtonLink>
          </div>
          <p className="mt-6 font-body text-xs text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-gold underline">
              Log in
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
