import type { Config } from 'tailwindcss';
import { colors } from '@yenetta/shared';

/**
 * Tailwind theme is the Yenetta brand layer: the palette comes straight from
 * the shared design tokens so web and mobile never drift.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: colors.gold,
        'gold-deep': colors.goldDeep,
        bronze: colors.bronze,
        cream: colors.cream,
        paper: colors.paper,
        ink: colors.ink,
        muted: colors.muted,
        success: colors.success,
        warn: colors.warn,
        error: colors.error,
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Poppins', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        amharic: ['Noto Sans Ethiopic', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        flame: 'linear-gradient(135deg, #633D0D 0%, #8A5D21 50%, #B08A45 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
