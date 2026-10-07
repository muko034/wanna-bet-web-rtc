import { renderHook } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolutionState } from '../protocol/messages';
import { RESULT_SCREEN_DURATION_MS, type ResultMemory } from './result-screen';
import { useResultScreenExpiry } from './use-result-screen-expiry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function memoryShownAt(shownAt: number): ResultMemory {
  const resolution: ResolutionState = { challengerId: 'host-1', outcome: 'YES', payouts: [] };
  return { shown: { resolution, players: [], shownAt }, broadcast: resolution };
}

describe('useResultScreenExpiry', () => {
  it('expires the shown result once its duration has passed', () => {
    const setMemory = vi.fn();
    renderHook(() => useResultScreenExpiry(memoryShownAt(Date.now()), setMemory));

    vi.advanceTimersByTime(RESULT_SCREEN_DURATION_MS - 1);
    expect(setMemory).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setMemory).toHaveBeenCalledWith(expect.objectContaining({ shown: null }));
  });

  it('counts the delay from when the result was first shown', () => {
    const setMemory = vi.fn();
    const shownAt = Date.now() - 3_000;
    renderHook(() => useResultScreenExpiry(memoryShownAt(shownAt), setMemory));

    vi.advanceTimersByTime(RESULT_SCREEN_DURATION_MS - 3_000);

    expect(setMemory).toHaveBeenCalledOnce();
  });

  it('does not start a timer while no result is shown', () => {
    renderHook(() => useResultScreenExpiry({ shown: null, broadcast: null }, vi.fn()));

    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts the timer when a new result is shown', () => {
    const setMemory = vi.fn();
    const { rerender } = renderHook(({ memory }) => useResultScreenExpiry(memory, setMemory), {
      initialProps: { memory: memoryShownAt(Date.now()) },
    });

    vi.advanceTimersByTime(4_000);
    rerender({ memory: memoryShownAt(Date.now()) });
    vi.advanceTimersByTime(RESULT_SCREEN_DURATION_MS - 1);
    expect(setMemory).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setMemory).toHaveBeenCalledOnce();
  });

  it('clears the timer on unmount', () => {
    const setMemory = vi.fn();
    const { unmount } = renderHook(() => useResultScreenExpiry(memoryShownAt(Date.now()), setMemory));

    unmount();
    vi.advanceTimersByTime(RESULT_SCREEN_DURATION_MS);

    expect(setMemory).not.toHaveBeenCalled();
  });
});
