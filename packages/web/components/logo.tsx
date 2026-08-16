import { APP_WORDMARK } from '@yenetta/shared';

export function Flame({ className = '' }: { className?: string }) {
  // Brand mark placeholder: a "Y" monogram on the flame gradient. Replace with
  // the real logo SVG in public/brand/ (no emoji fallbacks, per project rule).
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-flame font-heading font-bold text-white ${className}`}
      aria-hidden
    >
      Y
    </span>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims =
    size === 'lg' ? 'h-12 w-12 text-2xl' : size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-lg';
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <span className="inline-flex items-center gap-2">
      <Flame className={dims} />
      <span className={`font-heading font-bold text-ink ${text}`}>{APP_WORDMARK}</span>
    </span>
  );
}
