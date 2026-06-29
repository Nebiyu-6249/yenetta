'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui';
import { Logo } from '../../components/logo';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestOtp(phone);
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many requests — wait a bit.'
          : 'Enter a valid phone number.',
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.verifyOtp(phone, code);
      login(data);
      router.replace('/chat');
    } catch {
      setError('Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-2xl border border-gold/15 bg-white p-7 shadow-sm">
          {step === 'phone' ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <h1 className="font-heading text-xl font-bold text-ink">Welcome to Yenetta</h1>
                <p className="mt-1 font-body text-sm text-muted">
                  Sign in with your phone number to start studying.
                </p>
              </div>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9XX XXX XXX"
                className="w-full rounded-lg border border-gold/30 bg-paper px-3 py-2.5 font-body text-sm outline-none focus:border-gold"
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending…' : 'Send code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <h1 className="font-heading text-xl font-bold text-ink">Enter your code</h1>
                <p className="mt-1 font-body text-sm text-muted">
                  We sent a 6-digit code to {phone}.
                </p>
              </div>
              {devCode && (
                <p className="rounded-lg bg-cream px-3 py-2 font-body text-xs text-bronze">
                  Dev code: <strong>{devCode}</strong>
                </p>
              )}
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-lg border border-gold/30 bg-paper px-3 py-2.5 text-center font-body text-lg tracking-widest outline-none focus:border-gold"
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-full font-body text-xs text-muted hover:text-ink"
              >
                Use a different number
              </button>
            </form>
          )}
          {error && <p className="mt-3 font-body text-sm text-error">{error}</p>}
        </div>
      </div>
    </main>
  );
}
