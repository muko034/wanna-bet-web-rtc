import { useEffect, useRef, useState } from 'preact/hooks';
import { resolveTimerView, type TimerView } from './challenge-timer';
import { createTimerSound, type TimerSound } from './timer-sound';
import { useWakeLock } from './use-wake-lock';

const TICK_MS = 200;
/** A tick later than this after the end means the player was away, so the signal would only startle them. */
const LATE_SIGNAL_MS = 1_000;

/**
 * A local countdown of `durationMs`. It keeps the end timestamp, not a tick count, so a tab that was in the background
 * shows the true time left. Plays the end sound only when the end is seen as it happens, and keeps the screen awake
 * while running.
 */
export function useChallengeTimer(
  durationMs: number,
  now: () => number = Date.now,
): { view: TimerView; start: () => void; stop: () => void } {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const soundRef = useRef<TimerSound | null>(null);

  const view = resolveTimerView(endAt, nowMs, durationMs);
  useWakeLock(view.status === 'running');

  useEffect(() => {
    if (endAt === null) return;

    let finished = false;
    const tick = () => {
      if (finished) return;
      const current = now();
      setNowMs(current);
      if (current >= endAt) {
        finished = true;
        clearInterval(timer);
        if (current - endAt <= LATE_SIGNAL_MS) soundRef.current?.play();
      }
    };
    const timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      finished = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endAt]);

  useEffect(() => () => soundRef.current?.close(), []);

  const start = () => {
    soundRef.current ??= createTimerSound();
    const startedAt = now();
    setNowMs(startedAt);
    setEndAt(startedAt + durationMs);
  };
  const stop = () => setEndAt(null);

  return { view, start, stop };
}
