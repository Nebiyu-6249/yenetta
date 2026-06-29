'use client';

import { useAuth } from '../../../lib/auth';
import { PlanCards } from '../../../components/plan-cards';
import { Card } from '../../../components/ui';

export default function PaywallPage() {
  const { entitlement } = useAuth();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-bold text-ink">Upgrade to Premium</h1>
        <p className="mx-auto mt-2 max-w-lg font-body text-sm text-muted">
          Unlock unlimited AI tutoring, full ESSLCE/EUEE entrance-exam prep, unlimited mock exams,
          and personalized study plans.
        </p>
      </div>

      <PlanCards currentTier={entitlement?.tier} />

      <Card className="mt-8 bg-cream/40 text-center">
        <p className="font-body text-sm text-bronze">
          💳 Secure checkout with <strong>Telebirr</strong>, <strong>CBE Birr</strong>, or card via
          Chapa is being connected (Milestone&nbsp;6). Your progress is always kept, even on the
          free plan.
        </p>
      </Card>
    </div>
  );
}
