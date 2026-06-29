import { describe, expect, it } from 'vitest';
import { INITIAL_SR_STATE, MIN_EASE, nextDueDate, scheduleSm2 } from './sm2';

describe('scheduleSm2', () => {
  it('schedules the first two successful reviews at 1 then 6 days', () => {
    const first = scheduleSm2(INITIAL_SR_STATE, 5);
    expect(first.intervalDays).toBe(1);
    expect(first.reps).toBe(1);

    const second = scheduleSm2(first, 5);
    expect(second.intervalDays).toBe(6);
    expect(second.reps).toBe(2);
  });

  it('grows the interval by the easiness factor after the second review', () => {
    let state = scheduleSm2(INITIAL_SR_STATE, 4);
    state = scheduleSm2(state, 4);
    const third = scheduleSm2(state, 4);
    expect(third.intervalDays).toBeGreaterThan(6);
  });

  it('resets to 1 day and records a lapse on a failed review', () => {
    const passed = scheduleSm2(scheduleSm2(INITIAL_SR_STATE, 5), 5);
    const failed = scheduleSm2(passed, 1);
    expect(failed.intervalDays).toBe(1);
    expect(failed.reps).toBe(0);
    expect(failed.lapses).toBe(1);
  });

  it('never lets the easiness factor drop below the minimum', () => {
    let state = INITIAL_SR_STATE;
    for (let i = 0; i < 10; i++) state = scheduleSm2(state, 0);
    expect(state.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });

  it('computes a future due date', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(nextDueDate(6, from).toISOString()).toBe('2026-01-07T00:00:00.000Z');
  });
});
