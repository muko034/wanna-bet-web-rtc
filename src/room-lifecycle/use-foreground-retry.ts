import { useEffect, useRef } from 'preact/hooks';

/**
 * Triggers `onForeground` on every genuine visibilitychange-to-visible transition while
 * `active` is true — used to attempt an immediate Guest reconnect as soon as this device's
 * own tab comes back to the foreground, instead of leaving it to wait out whatever automatic
 * retry delay it happened to be backed off to (see `guest-reconnect.ts`). The listener itself
 * is attached exactly once; `active`/`onForeground` are read through a ref on every firing so
 * a caller passing fresh values each render doesn't need to worry about re-subscribing (and,
 * critically, doesn't retrigger on a tab that was already visible — `visibilitychange` only
 * fires on a real transition).
 */
export function useForegroundRetry(active: boolean, onForeground: () => void): void {
  const stateRef = useRef({ active, onForeground });
  stateRef.current = { active, onForeground };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && stateRef.current.active) {
        stateRef.current.onForeground();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
