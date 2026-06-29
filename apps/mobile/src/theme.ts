import { colors, radius, spacing } from '@yenetta/shared';

/** Brand theme for React Native styles (sourced from shared tokens). */
export const theme = {
  colors: {
    gold: colors.gold,
    goldDeep: colors.goldDeep,
    bronze: colors.bronze,
    cream: colors.cream,
    paper: colors.paper,
    ink: colors.ink,
    muted: colors.muted,
    success: colors.success,
    error: colors.error,
    white: '#FFFFFF',
    border: 'rgba(176,138,69,0.18)',
  },
  spacing,
  radius,
} as const;
