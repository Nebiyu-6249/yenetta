'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '../../components/logo';
import { Spinner } from '../../components/ui';
import { useRequireAuth } from '../../lib/auth';

const NAV = [
  { href: '/chat', label: 'Tutor' },
  { href: '/study', label: 'Study' },
  { href: '/practice', label: 'Exam Practice' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, entitlement, loading, logout } = useRequireAuth();
  const pathname = usePathname();

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner label="Loading…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-gold/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/chat">
              <Logo size="sm" />
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 font-body text-sm transition ${
                      active ? 'bg-cream font-semibold text-bronze' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/paywall"
              className={`rounded-full px-3 py-1 font-body text-xs font-medium ${
                entitlement?.tier === 'premium'
                  ? 'bg-gold/15 text-gold-deep'
                  : 'bg-cream text-bronze hover:bg-gold/20'
              }`}
            >
              {entitlement?.tier === 'premium' ? 'Premium' : 'Free · Upgrade'}
            </Link>
            <button
              onClick={logout}
              className="font-body text-sm text-muted hover:text-ink"
              aria-label="Log out"
            >
              Log out
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-gold/10 px-4 py-2 sm:hidden">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-body text-sm ${
                  active ? 'bg-cream font-semibold text-bronze' : 'text-muted'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
