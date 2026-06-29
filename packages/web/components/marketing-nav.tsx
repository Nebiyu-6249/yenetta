import Link from 'next/link';
import { ButtonLink } from './ui';
import { Logo } from './logo';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-gold/10 bg-paper/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-6 font-body text-sm">
          <Link href="/pricing" className="hidden text-muted hover:text-ink sm:block">
            Pricing
          </Link>
          <Link href="/login" className="text-muted hover:text-ink">
            Log in
          </Link>
          <ButtonLink href="/chat" variant="primary">
            Open app
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-cream/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <Logo size="sm" />
        <p className="font-body text-xs text-muted">
          © {new Date().getFullYear()} Yenetta · Grounded in the Ethiopian curriculum.
        </p>
        <div className="flex gap-4 font-body text-xs text-muted">
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-ink">
            Log in
          </Link>
        </div>
      </div>
    </footer>
  );
}
