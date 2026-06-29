/**
 * SM-2 spaced-repetition scheduler (BUILD_BRIEF §5). Pure and isomorphic so it
 * runs identically on the server and offline on the mobile device.
 */

export interface SrState {
  /** Easiness factor (>= 1.3). */
  ease: number;
  /** Current interval in days. */
  interval: number;
  /** Successful repetitions in a row. */
  reps: number;
  /** Times the card has been forgotten. */
  lapses: number;
}

export interface SrSchedule extends SrState {
  /** Days until the card is next due. */
  intervalDays: number;
}

export const INITIAL_SR_STATE: SrState = { ease: 2.5, interval: 0, reps: 0, lapses: 0 };

export const MIN_EASE = 1.3;

/**
 * Applies an SM-2 review. `grade` is 0–5 (>=3 is a pass). Returns the updated
 * state and the next interval in days; the caller computes `dueAt`.
 */
export function scheduleSm2(state: SrState, grade: number): SrSchedule {
  const g = Math.max(0, Math.min(5, Math.round(grade)));

  // Update easiness factor (clamped).
  const ease = Math.max(MIN_EASE, state.ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));

  if (g < 3) {
    // Lapse: relearn from a 1-day interval.
    return { ease, interval: 1, reps: 0, lapses: state.lapses + 1, intervalDays: 1 };
  }

  let interval: number;
  if (state.reps === 0) {
    interval = 1;
  } else if (state.reps === 1) {
    interval = 6;
  } else {
    interval = Math.round(state.interval * ease);
  }

  return { ease, interval, reps: state.reps + 1, lapses: state.lapses, intervalDays: interval };
}

/** Convenience: next due date from now + interval days. */
export function nextDueDate(intervalDays: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}
