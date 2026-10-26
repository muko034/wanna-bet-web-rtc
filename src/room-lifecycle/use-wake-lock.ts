import { useEffect } from 'preact/hooks';

/**
 * Keeps the screen awake while `active`. The lock is released while the tab is hidden and taken again when it is visible.
 * A browser without Wake Lock, or one that refuses the request, is skipped silently.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const release = () => {
      const held = sentinel;
      sentinel = null;
      void held?.release().catch(() => undefined);
    };
    const acquire = async () => {
      if (sentinel || document.hidden) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled || sentinel || document.hidden) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
      } catch {
        // A refused request just leaves the screen free to dim.
      }
    };
    const handleVisibilityChange = () => (document.hidden ? release() : void acquire());

    void acquire();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [active]);
}
