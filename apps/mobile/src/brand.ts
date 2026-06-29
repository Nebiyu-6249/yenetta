import { colors, APP_WORDMARK } from '@yenetta/shared';

/** Small helper so screens (and tests) share one source for brand strings. */
export function brandHeader(): { wordmark: string; primary: string } {
  return { wordmark: APP_WORDMARK, primary: colors.gold };
}
