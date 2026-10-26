import { describe, expect, it } from 'vitest';
import { resolveTimerView } from './challenge-timer';

const DURATION_MS = 30_000;

describe('resolveTimerView', () => {
  it('is idle while no Timer runs', () => {
    expect(resolveTimerView(null, 5_000, DURATION_MS)).toEqual({ status: 'idle' });
  });

  it.each([
    ['at the start', 30_000, 30, 1, false],
    ['just after the start', 29_999, 30, 29_999 / 30_000, false],
    ['half way', 15_000, 15, 0.5, false],
    ['with 6 seconds left', 6_000, 6, 0.2, false],
    ['with a bit over 5 seconds left', 5_001, 6, 5_001 / 30_000, false],
    ['with exactly 5 seconds left', 5_000, 5, 5 / 30, true],
    ['in the last second', 1, 1, 1 / 30_000, true],
  ])('runs %s', (_name, remainingMs, seconds, fraction, urgent) => {
    expect(resolveTimerView(100_000, 100_000 - remainingMs, DURATION_MS)).toEqual({ status: 'running', seconds, fraction, urgent });
  });

  it.each([
    ['at the end', 0],
    ['long after the end', 60_000],
  ])('is done at 0 and not urgent %s', (_name, lateMs) => {
    expect(resolveTimerView(100_000, 100_000 + lateMs, DURATION_MS)).toEqual({ status: 'done', seconds: 0, fraction: 0, urgent: false });
  });
});
