'use client';

import { useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { PlanCards } from '../../../components/plan-cards';
import { Button, Card } from '../../../components/ui';

export default function PaywallPage() {
  const { entitlement, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [voucher, setVoucher] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const startCheckout = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { checkoutUrl } = await api.checkout();
      // Chapa hosts the checkout; we redirect the student there.
      window.location.href = checkoutUrl;
    } catch (e) {
      setMessage(e instanceof ApiError ? `Checkout error (${e.status})` : 'Checkout failed.');
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.redeemVoucher(voucher);
      await refresh();
      setMessage('🎉 Premium unlocked!');
    } catch {
      setMessage('Invalid or expired voucher code.');
    } finally {
      setBusy(false);
    }
  };

  const premium = entitlement?.tier === 'premium';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-bold text-ink">
          {premium ? 'You’re on Premium 🎉' : 'Upgrade to Premium'}
        </h1>
        <p className="mx-auto mt-2 max-w-lg font-body text-sm text-muted">
          Unlock unlimited AI tutoring, full ESSLCE/EUEE prep, unlimited mock exams, and study plans.
        </p>
      </div>

      <PlanCards currentTier={entitlement?.tier} />

      {!premium && (
        <Card className="mt-8">
          <h2 className="font-heading text-base font-semibold text-ink">Checkout</h2>
          <p className="mt-1 font-body text-sm text-muted">
            Pay with Telebirr, CBE Birr, or card via Chapa.
          </p>
          <div className="mt-4">
            <Button onClick={() => void startCheckout()} disabled={busy}>
              {busy ? 'Starting…' : 'Pay with Chapa'}
            </Button>
          </div>

          <div className="mt-6 border-t border-gold/10 pt-4">
            <p className="mb-2 font-body text-sm font-medium text-ink">Have a voucher / scratch code?</p>
            <div className="flex gap-2">
              <input
                value={voucher}
                onChange={(e) => setVoucher(e.target.value)}
                placeholder="YENETTA-PREMIUM"
                className="flex-1 rounded-lg border border-gold/30 bg-paper px-3 py-2 font-body text-sm outline-none focus:border-gold"
              />
              <Button variant="secondary" onClick={() => void redeem()} disabled={busy || !voucher}>
                Redeem
              </Button>
            </div>
          </div>
          {message && <p className="mt-3 font-body text-sm text-gold-deep">{message}</p>}
        </Card>
      )}
    </div>
  );
}
