import { describe, expect, it } from 'vitest';
import { colors, flameGradient, theme } from './tokens';

describe('design tokens', () => {
  it('exposes the primary gold brand color', () => {
    expect(colors.gold).toBe('#B08A45');
  });

  it('builds the flame gradient from bronze → gold-deep → gold', () => {
    expect(flameGradient.stops).toEqual(['#633D0D', '#8A5D21', '#B08A45']);
    expect(flameGradient.css).toContain('#B08A45');
  });

  it('bundles all token groups into the theme object', () => {
    expect(theme.colors).toBe(colors);
    expect(theme.spacing.md).toBe(16);
    expect(theme.radius.full).toBe(9999);
  });
});
