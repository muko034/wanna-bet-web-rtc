import { renderHook } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useForegroundRetry } from './use-foreground-retry';

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => vi.restoreAllMocks());

describe('useForegroundRetry', () => {
  it('calls onForeground when the page becomes visible while active', () => {
    const onForeground = vi.fn();
    renderHook(() => useForegroundRetry(true, onForeground));

    setVisibility('visible');

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it('does not call onForeground when the page becomes hidden', () => {
    const onForeground = vi.fn();
    renderHook(() => useForegroundRetry(true, onForeground));

    setVisibility('hidden');

    expect(onForeground).not.toHaveBeenCalled();
  });

  it('does not call onForeground while inactive', () => {
    const onForeground = vi.fn();
    renderHook(() => useForegroundRetry(false, onForeground));

    setVisibility('visible');

    expect(onForeground).not.toHaveBeenCalled();
  });

  it('calls the latest callback without re-attaching the listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useForegroundRetry(true, cb), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    setVisibility('visible');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', () => {
    const onForeground = vi.fn();
    const { unmount } = renderHook(() => useForegroundRetry(true, onForeground));

    unmount();
    setVisibility('visible');

    expect(onForeground).not.toHaveBeenCalled();
  });
});
