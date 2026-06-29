import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-white hover:bg-gold-deep shadow-sm',
  secondary: 'bg-cream text-bronze hover:bg-gold/20',
  ghost: 'text-gold hover:bg-gold/10',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-body text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-gold/15 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'gold',
}: {
  children: ReactNode;
  tone?: 'gold' | 'cream' | 'success' | 'error';
}) {
  const tones = {
    gold: 'bg-gold/15 text-gold-deep',
    cream: 'bg-cream text-bronze',
    success: 'bg-success/15 text-success',
    error: 'bg-error/15 text-error',
  };
  return (
    <span className={`rounded-full px-3 py-1 font-body text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 font-body text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      {label}
    </div>
  );
}

export function Container({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</div>;
}
