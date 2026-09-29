import { useEffect, useRef } from 'preact/hooks';

/** Calls `onForeground` on each visibilitychange to visible while `active`. Values are read through a ref, so the listener attaches once. */
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
