import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The repo has no DOM environment, so `preact/hooks` is replaced by a minimal single-component
// runner: `useState` keeps one value per slot, `useEffect` re-runs when its deps change.
const runner = vi.hoisted(() => ({
  slots: [] as unknown[],
  deps: [] as (unknown[] | undefined)[],
  cleanups: [] as ((() => void) | undefined)[],
  pending: [] as (() => void)[],
  stateIndex: 0,
  effectIndex: 0,
}));

vi.mock('preact/hooks', () => ({
  useState: <T>(initial: T) => {
    const i = runner.stateIndex++;
    if (!(i in runner.slots)) runner.slots[i] = initial;
    return [runner.slots[i] as T, (value: T) => { runner.slots[i] = value; }] as const;
  },
  useEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
    const i = runner.effectIndex++;
    const prev = runner.deps[i];
    if (prev && prev.every((d, j) => Object.is(d, deps[j]))) return;
    runner.deps[i] = deps;
    runner.pending.push(() => {
      runner.cleanups[i]?.();
      runner.cleanups[i] = effect() ?? undefined;
    });
  },
}));

import { useLinkLostDuration } from './use-link-lost-duration';

function renderHook(lost: boolean, now: () => number): number | null {
  runner.stateIndex = 0;
  runner.effectIndex = 0;
  useLinkLostDuration(lost, now);
  const effects = runner.pending.splice(0);
  effects.forEach((run) => run());
  runner.stateIndex = 0;
  runner.effectIndex = 0;
  return useLinkLostDuration(lost, now);
}

beforeEach(() => {
  vi.useFakeTimers();
  runner.slots.length = 0;
  runner.deps.length = 0;
  runner.cleanups.length = 0;
  runner.pending.length = 0;
});
afterEach(() => vi.useRealTimers());

describe('useLinkLostDuration', () => {
  it('measures elapsed time from the injected clock, not the real one', () => {
    let clock = 5_000;
    const now = () => clock;

    expect(renderHook(false, now)).toBeNull();
    expect(renderHook(true, now)).toBe(0);

    clock = 7_500;
    vi.advanceTimersByTime(1_000);

    expect(renderHook(true, now)).toBe(2_500);
  });

  it('returns null again once the link is no longer lost', () => {
    const now = () => 0;
    renderHook(true, now);

    expect(renderHook(false, now)).toBeNull();
  });
});
