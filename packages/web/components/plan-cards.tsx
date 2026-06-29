import { PLANS } from '../lib/plans';
import { ButtonLink } from './ui';

export function PlanCards({ currentTier }: { currentTier?: 'free' | 'premium' }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {PLANS.map((plan) => {
        const isCurrent = currentTier === plan.id;
        return (
          <div
            key={plan.id}
            className={`rounded-2xl border p-7 ${
              plan.highlighted
                ? 'border-gold bg-white shadow-md'
                : 'border-gold/15 bg-white shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold text-ink">{plan.name}</h3>
              {plan.highlighted && (
                <span className="rounded-full bg-flame px-3 py-1 font-body text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
            </div>
            <p className="mt-1 font-body text-sm text-muted">{plan.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-heading text-3xl font-bold text-ink">{plan.price}</span>
              <span className="font-body text-sm text-muted">/ {plan.cadence}</span>
            </div>
            <ul className="mt-6 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2 font-body text-sm text-ink">
                  <span className="text-gold">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              {isCurrent ? (
                <span className="inline-flex w-full items-center justify-center rounded-lg bg-cream px-5 py-2.5 font-body text-sm font-semibold text-bronze">
                  Your current plan
                </span>
              ) : plan.id === 'premium' ? (
                <ButtonLink href="/paywall" variant="primary" className="w-full">
                  Upgrade to Premium
                </ButtonLink>
              ) : (
                <ButtonLink href="/login" variant="secondary" className="w-full">
                  Get started
                </ButtonLink>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
