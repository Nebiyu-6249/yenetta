import type { Metadata } from 'next';
import { Footer, MarketingNav } from '../../components/marketing-nav';
import { PlanCards } from '../../components/plan-cards';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Yenetta pricing — a free tier to start studying and a Premium plan for full ESSLCE/EUEE entrance-exam prep, unlimited mock exams, and study plans.',
};

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="font-heading text-4xl font-bold text-ink">
            Simple, student-friendly pricing
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-body text-muted">
            Start free. Upgrade when you&rsquo;re ready for full entrance-exam preparation. Pay with
            Telebirr, CBE Birr, or card via Chapa.
          </p>
        </div>
        <PlanCards />
      </main>
      <Footer />
    </>
  );
}
