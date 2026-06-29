/**
 * Yenetta design tokens — the brand layer shared across web and mobile.
 * Colors sampled from the Yenetta logos (gold flame + "የነታ" Amharic mark).
 */

export const colors = {
  /** Primary brand — buttons, links, active states. */
  gold: '#B08A45',
  /** Hovers, gradients. */
  goldDeep: '#8A5D21',
  /** Dark accent, gradient end, icon ink. */
  bronze: '#633D0D',
  /** Warm cards / sections. */
  cream: '#F4ECDF',
  /** App background. */
  paper: '#F7F7F5',
  /** Primary text (warm near-black). */
  ink: '#2A2118',
  /** Secondary text. */
  muted: '#6B6256',
  /** Feedback states. */
  success: '#2E7D32',
  warn: '#B8860B',
  error: '#C0392B',
} as const;

/** Flame gradient used in the logo/icon and hero accents. */
export const flameGradient = {
  stops: ['#633D0D', '#8A5D21', '#B08A45'] as const,
  css: 'linear-gradient(135deg, #633D0D 0%, #8A5D21 50%, #B08A45 100%)',
};

export const typography = {
  /** Warm rounded sans for headings (matches the wordmark). */
  heading: "'Poppins', 'Outfit', system-ui, sans-serif",
  /** Inter for body copy. */
  body: "'Inter', system-ui, sans-serif",
  /** Amharic script (wired from day one for Phase 2). */
  amharic: "'Noto Sans Ethiopic', system-ui, sans-serif",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/** Single object consumed by Tailwind config, RN theme, etc. */
export const theme = {
  colors,
  flameGradient,
  typography,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
export type ColorToken = keyof typeof colors;
