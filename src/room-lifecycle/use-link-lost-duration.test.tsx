import { renderHook } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinkLostDuration } from './use-link-lost-duration';

beforeEach(() => vi.useFakeTimers());

describe('useLinkLostDuration', () => {
  it('measures elapsed time from the injected clock, not the real one', () => {
    let clock = 5_000;
    const now = () => clock;

    const { result, rerender } = renderHook(({ lost }) => useLinkLostDuration(lost, now), {
      initialProps: { lost: false },
    });
    expect(result.current).toBeNull();

    rerender({ lost: true });
    expect(result.current).toBe(0);

    clock = 7_500;
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current).toBe(2_500);
  });

  it('returns null again once the link is no longer lost', () => {
    const now = () => 0;
    const { result, rerender } = renderHook(({ lost }) => useLinkLostDuration(lost, now), {
      initialProps: { lost: true },
    });

    rerender({ lost: false });

    expect(result.current).toBeNull();
  });
});
